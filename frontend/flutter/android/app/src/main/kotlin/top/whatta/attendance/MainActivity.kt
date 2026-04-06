package top.whatta.attendance

import android.content.Intent
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.spec.ECGenParameterSpec

class MainActivity : FlutterActivity() {
    private val channel = "pas/secure_store"
    private val nfcHceChannel = "pas/nfc_hce"
    private val bleAdvertiseChannel = "pas/ble_advertise"
    private val keyAlias = "pas_device_key"
    private val keyStoreProvider = "AndroidKeyStore"
    private var bleAdvertiser: NativeBleAdvertiser? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "ensureKeyExists" -> {
                        try {
                            result.success(ensureKeyExists())
                        } catch (e: Exception) {
                            result.error("KEYSTORE_ERROR", e.message, null)
                        }
                    }

                    "getPublicKey" -> {
                        try {
                            result.success(getPublicKey())
                        } catch (e: Exception) {
                            result.error("KEYSTORE_ERROR", e.message, null)
                        }
                    }

                    "signPayload" -> {
                        try {
                            val payload = call.arguments as? ByteArray
                            if (payload == null) {
                                result.error(
                                    "INVALID_ARGUMENT",
                                    "Payload must be provided as bytes",
                                    null
                                )
                            } else {
                                result.success(signPayload(payload))
                            }
                        } catch (e: Exception) {
                            result.error("KEYSTORE_ERROR", e.message, null)
                        }
                    }

                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, nfcHceChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "start" -> {
                        val token = call.argument<String>("token")
                        if (token == null) {
                            result.error("INVALID_ARGUMENT", "token is required", null)
                        } else {
                            NfcHceService.currentToken = token
                            startService(Intent(this, NfcHceService::class.java))
                            result.success(null)
                        }
                    }
                    "stop" -> {
                        NfcHceService.currentToken = null
                        stopService(Intent(this, NfcHceService::class.java))
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }

        bleAdvertiser = NativeBleAdvertiser(this)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, bleAdvertiseChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "start" -> {
                        val payload = call.argument<String>("payload")
                        if (payload == null) {
                            result.error("INVALID_ARGUMENT", "payload is required", null)
                        } else {
                            val success = bleAdvertiser?.start(payload) ?: false
                            result.success(success)
                        }
                    }
                    "stop" -> {
                        bleAdvertiser?.stop()
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun generateKey() {
        val keyGenerator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            keyStoreProvider
        )
        val builder = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_SIGN
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(false)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                builder.setIsStrongBoxBacked(true)
            } catch (_: Exception) {
            }
        }

        keyGenerator.initialize(builder.build())
        keyGenerator.generateKeyPair()
    }

    private fun ensureKeyExists(): Boolean {
        val keyStore = KeyStore.getInstance(keyStoreProvider).apply { load(null) }
        if (keyStore.containsAlias(keyAlias)) {
            return true
        }

        generateKey()
        return true
    }

    private fun getPublicKey(): ByteArray? {
        ensureKeyExists()

        val keyStore = KeyStore.getInstance(keyStoreProvider).apply { load(null) }
        val entry = keyStore.getEntry(keyAlias, null) as? KeyStore.PrivateKeyEntry
        return entry?.certificate?.publicKey?.encoded
    }

    private fun signPayload(payload: ByteArray): ByteArray? {
        ensureKeyExists()

        val keyStore = KeyStore.getInstance(keyStoreProvider).apply { load(null) }
        val entry = keyStore.getEntry(keyAlias, null) as? KeyStore.PrivateKeyEntry
        val privateKey = entry?.privateKey ?: return null

        val signature = java.security.Signature.getInstance("SHA256withECDSA")
        signature.initSign(privateKey)
        signature.update(payload)
        return signature.sign()
    }
}