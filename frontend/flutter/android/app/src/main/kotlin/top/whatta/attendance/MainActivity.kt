package top.whatta.attendance

import android.content.Intent
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.spec.ECGenParameterSpec

class MainActivity : FlutterFragmentActivity() {
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

                    "signPayloadWithBiometric" -> {
                        val payload = call.arguments as? ByteArray
                        if (payload == null) {
                            result.error(
                                "INVALID_ARGUMENT",
                                "Payload must be provided as bytes",
                                null
                            )
                        } else {
                            signPayloadWithBiometric(payload, result)
                        }
                    }

                    "deleteKey" -> {
                        try {
                            deleteKey()
                            result.success(true)
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

    private fun generateKey(strongBoxBacked: Boolean) {
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
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && strongBoxBacked) {
            builder.setIsStrongBoxBacked(true)
        }

        keyGenerator.initialize(builder.build())
        keyGenerator.generateKeyPair()
    }

    private fun ensureKeyExists(): Boolean {
        return try {
            val keyStore = KeyStore.getInstance(keyStoreProvider).apply { load(null) }
            if (keyStore.containsAlias(keyAlias)) {
                return true
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try {
                    generateKey(strongBoxBacked = true)
                    return true
                } catch (_: Exception) {
                }
            }

            generateKey(strongBoxBacked = false)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun getPublicKey(): ByteArray? {
        if (!ensureKeyExists()) {
            return null
        }

        val keyStore = KeyStore.getInstance(keyStoreProvider).apply { load(null) }
        val entry = keyStore.getEntry(keyAlias, null) as? KeyStore.PrivateKeyEntry
        return entry?.certificate?.publicKey?.encoded
    }

    private fun signPayload(payload: ByteArray): ByteArray? {
        if (!ensureKeyExists()) {
            return null
        }

        val keyStore = KeyStore.getInstance(keyStoreProvider).apply { load(null) }
        val entry = keyStore.getEntry(keyAlias, null) as? KeyStore.PrivateKeyEntry
        val privateKey = entry?.privateKey ?: return null

        val signature = java.security.Signature.getInstance("SHA256withECDSA")
        signature.initSign(privateKey)
        signature.update(payload)
        return signature.sign()
    }

    private fun deleteKey() {
        val keyStore = KeyStore.getInstance(keyStoreProvider).apply { load(null) }
        if (keyStore.containsAlias(keyAlias)) {
            keyStore.deleteEntry(keyAlias)
        }
    }

    private fun signPayloadWithBiometric(payload: ByteArray, result: MethodChannel.Result) {
        try {
            if (!ensureKeyExists()) {
                result.error("KEYSTORE_ERROR", "Key does not exist", null)
                return
            }

            val keyStore = KeyStore.getInstance(keyStoreProvider).apply { load(null) }
            val entry = keyStore.getEntry(keyAlias, null) as? KeyStore.PrivateKeyEntry
            val privateKey = entry?.privateKey
            if (privateKey == null) {
                result.error("KEYSTORE_ERROR", "Private key not found", null)
                return
            }

            val sig = java.security.Signature.getInstance("SHA256withECDSA")
            sig.initSign(privateKey)

            val cryptoObject = BiometricPrompt.CryptoObject(sig)

            val executor = ContextCompat.getMainExecutor(this)
            val biometricPrompt = BiometricPrompt(
                this,
                executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(authResult: BiometricPrompt.AuthenticationResult) {
                        try {
                            val authedSig = authResult.cryptoObject?.signature
                            if (authedSig == null) {
                                result.error("BIOMETRIC_ERROR", "No signature after auth", null)
                                return
                            }
                            authedSig.update(payload)
                            result.success(authedSig.sign())
                        } catch (e: Exception) {
                            result.error("KEYSTORE_ERROR", e.message, null)
                        }
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        result.error("BIOMETRIC_ERROR", errString.toString(), errorCode.toString())
                    }

                    override fun onAuthenticationFailed() {
                    }
                }
            )

            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Verify identity")
                .setSubtitle("Authenticate to check in")
                .setNegativeButtonText("Cancel")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build()

            biometricPrompt.authenticate(promptInfo, cryptoObject)
        } catch (e: Exception) {
            result.error("BIOMETRIC_ERROR", e.message, null)
        }
    }
}