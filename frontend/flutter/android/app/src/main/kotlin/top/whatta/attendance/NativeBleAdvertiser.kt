package top.whatta.attendance

import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.ParcelUuid
import java.util.UUID

class NativeBleAdvertiser(private val context: Context) {
    private var advertiser: BluetoothLeAdvertiser? = null
    private var callback: AdvertiseCallback? = null

    fun start(payload: String): Boolean {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            ?: return false
        val adapter = manager.adapter ?: return false

        if (!adapter.isEnabled) return false

        advertiser = adapter.bluetoothLeAdvertiser ?: return false

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(false)
            .setTimeout(0)
            .build()

        val serviceUuid = ParcelUuid(UUID.fromString("0000fff0-0000-1000-8000-00805f9b34fb"))

        val payloadBytes = payload.toByteArray(Charsets.UTF_8)
        val maxServiceDataSize = 20
        val trimmedPayload = if (payloadBytes.size > maxServiceDataSize) {
            payloadBytes.copyOf(maxServiceDataSize)
        } else {
            payloadBytes
        }

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .addServiceUuid(serviceUuid)
            .addServiceData(serviceUuid, trimmedPayload)
            .build()

        val scanResponse = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .addServiceData(serviceUuid, payload.toByteArray(Charsets.UTF_8).take(20).toByteArray())
            .build()

        callback = object : AdvertiseCallback() {
            override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {}
            override fun onStartFailure(errorCode: Int) {}
        }

        advertiser?.startAdvertising(settings, data, scanResponse, callback)
        return true
    }

    fun stop() {
        callback?.let {
            advertiser?.stopAdvertising(it)
        }
        callback = null
        advertiser = null
    }
}
