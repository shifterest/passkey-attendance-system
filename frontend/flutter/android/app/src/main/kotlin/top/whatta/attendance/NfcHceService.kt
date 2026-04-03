package top.whatta.attendance

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

class NfcHceService : HostApduService() {

    override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray {
        val token = currentToken ?: return SW_UNKNOWN
        return when {
            commandApdu.startsWith(SELECT_NDEF_APP_AID) -> SW_OK
            commandApdu.startsWith(SELECT_CC) -> SW_OK
            commandApdu.startsWith(READ_CC) -> buildCcResponse(token)
            commandApdu.startsWith(SELECT_NDEF_FILE) -> SW_OK
            commandApdu.startsWith(READ_BINARY_PREFIX) -> buildNdefResponse(token)
            else -> SW_UNKNOWN
        }
    }

    override fun onDeactivated(reason: Int) {}

    private fun buildNdefRecord(token: String): ByteArray {
        val langCode = "en".toByteArray(Charsets.US_ASCII)
        val tokenBytes = token.toByteArray(Charsets.UTF_8)
        val payloadBytes = byteArrayOf(langCode.size.toByte()) + langCode + tokenBytes
        val record = ByteArray(4 + payloadBytes.size)
        record[0] = 0xD1.toByte()
        record[1] = 0x01.toByte()
        record[2] = payloadBytes.size.toByte()
        record[3] = 0x54.toByte()
        System.arraycopy(payloadBytes, 0, record, 4, payloadBytes.size)
        return record
    }

    private fun buildNdefResponse(token: String): ByteArray {
        val ndefRecord = buildNdefRecord(token)
        val length = ndefRecord.size.toShort()
        val response = ByteArray(2 + ndefRecord.size + 2)
        response[0] = (length.toInt() shr 8 and 0xFF).toByte()
        response[1] = (length.toInt() and 0xFF).toByte()
        System.arraycopy(ndefRecord, 0, response, 2, ndefRecord.size)
        response[response.size - 2] = 0x90.toByte()
        response[response.size - 1] = 0x00.toByte()
        return response
    }

    private fun buildCcResponse(token: String): ByteArray {
        val ndefSize = buildNdefRecord(token).size + 2
        val sizeHigh = (ndefSize shr 8 and 0xFF).toByte()
        val sizeLow = (ndefSize and 0xFF).toByte()
        return byteArrayOf(
            0x00, 0x0F, 0x20, 0x00, 0x3B, 0x00, 0x34, 0x04, 0x06,
            0xE1.toByte(), 0x04,
            sizeHigh, sizeLow,
            0x00, 0xFF.toByte(),
            0x90.toByte(), 0x00
        )
    }

    private fun ByteArray.startsWith(prefix: ByteArray): Boolean {
        if (this.size < prefix.size) return false
        return prefix.indices.all { this[it] == prefix[it] }
    }

    companion object {
        var currentToken: String? = null

        private val SELECT_NDEF_APP_AID = byteArrayOf(
            0x00, 0xA4.toByte(), 0x04, 0x00, 0x07,
            0xD2.toByte(), 0x76, 0x00, 0x00, 0x85.toByte(), 0x01, 0x01,
            0x00
        )
        private val SELECT_CC = byteArrayOf(0x00, 0xA4.toByte(), 0x00, 0x0C, 0x02, 0xE1.toByte(), 0x03)
        private val READ_CC = byteArrayOf(0x00, 0xB0.toByte(), 0x00, 0x00)
        private val SELECT_NDEF_FILE = byteArrayOf(0x00, 0xA4.toByte(), 0x00, 0x0C, 0x02, 0xE1.toByte(), 0x04)
        private val READ_BINARY_PREFIX = byteArrayOf(0x00, 0xB0.toByte())
        private val SW_OK = byteArrayOf(0x90.toByte(), 0x00)
        private val SW_UNKNOWN = byteArrayOf(0x6D, 0x00)
    }
}
