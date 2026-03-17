from api.schemas import AttendanceRecordVerificationMethods
from api.services.assurance_service import (
    assurance_score_from_verification_methods,
    compute_assurance_band,
)

PASSKEY = AttendanceRecordVerificationMethods.PASSKEY.value
DEVICE = AttendanceRecordVerificationMethods.DEVICE.value
PI = AttendanceRecordVerificationMethods.PLAY_INTEGRITY.value
GPS = AttendanceRecordVerificationMethods.GPS.value
NETWORK = AttendanceRecordVerificationMethods.NETWORK.value
QR = AttendanceRecordVerificationMethods.QR_PROXIMITY.value
BLE_STRONG = "bluetooth:-60"
BLE_MEDIUM = "bluetooth:-72"
BLE_WEAK = "bluetooth:-85"
BLE_NONE = "bluetooth:-95"


class TestProximityOnlyScoring:
    def test_passkey_does_not_contribute_score(self):
        assert assurance_score_from_verification_methods([PASSKEY]) == 0

    def test_device_does_not_contribute_score(self):
        assert assurance_score_from_verification_methods([DEVICE]) == 0

    def test_play_integrity_does_not_contribute_score(self):
        assert assurance_score_from_verification_methods([PI]) == 0

    def test_passkey_device_pi_together_score_zero(self):
        assert assurance_score_from_verification_methods([PASSKEY, DEVICE, PI]) == 0

    def test_empty_methods_score_zero(self):
        assert assurance_score_from_verification_methods([]) == 0

    def test_none_methods_score_zero(self):
        assert assurance_score_from_verification_methods(None) == 0


class TestBLEScoring:
    def test_ble_strong_vouched(self):
        assert (
            assurance_score_from_verification_methods(
                [BLE_STRONG], integrity_vouched=True
            )
            == 7
        )

    def test_ble_strong_absent(self):
        assert (
            assurance_score_from_verification_methods(
                [BLE_STRONG], integrity_vouched=False
            )
            == 4
        )

    def test_ble_medium_vouched(self):
        assert (
            assurance_score_from_verification_methods(
                [BLE_MEDIUM], integrity_vouched=True
            )
            == 4
        )

    def test_ble_medium_absent(self):
        assert (
            assurance_score_from_verification_methods(
                [BLE_MEDIUM], integrity_vouched=False
            )
            == 2
        )

    def test_ble_weak_vouched(self):
        assert (
            assurance_score_from_verification_methods(
                [BLE_WEAK], integrity_vouched=True
            )
            == 2
        )

    def test_ble_weak_absent(self):
        assert (
            assurance_score_from_verification_methods(
                [BLE_WEAK], integrity_vouched=False
            )
            == 1
        )

    def test_ble_below_threshold_scores_zero(self):
        assert (
            assurance_score_from_verification_methods(
                [BLE_NONE], integrity_vouched=True
            )
            == 0
        )
        assert (
            assurance_score_from_verification_methods(
                [BLE_NONE], integrity_vouched=False
            )
            == 0
        )


class TestGPSAndNetworkScoring:
    def test_gps_vouched(self):
        assert (
            assurance_score_from_verification_methods([GPS], integrity_vouched=True)
            == 3
        )

    def test_gps_absent(self):
        assert (
            assurance_score_from_verification_methods([GPS], integrity_vouched=False)
            == 1
        )

    def test_network_always_two(self):
        assert (
            assurance_score_from_verification_methods([NETWORK], integrity_vouched=True)
            == 2
        )
        assert (
            assurance_score_from_verification_methods(
                [NETWORK], integrity_vouched=False
            )
            == 2
        )

    def test_qr_always_four(self):
        assert (
            assurance_score_from_verification_methods([QR], integrity_vouched=True) == 4
        )
        assert (
            assurance_score_from_verification_methods([QR], integrity_vouched=False)
            == 4
        )


class TestCompositeScenarios:
    def test_strong_ble_gps_network_vouched_is_high(self):
        score = assurance_score_from_verification_methods(
            [PASSKEY, DEVICE, PI, BLE_STRONG, GPS, NETWORK],
            integrity_vouched=True,
        )
        assert score == 12

    def test_strong_ble_network_vouched_reaches_high_threshold(self):
        score = assurance_score_from_verification_methods(
            [PASSKEY, DEVICE, BLE_STRONG, NETWORK],
            integrity_vouched=True,
        )
        assert score == 9

    def test_strong_ble_network_absent_is_standard(self):
        score = assurance_score_from_verification_methods(
            [PASSKEY, DEVICE, BLE_STRONG, NETWORK],
            integrity_vouched=False,
        )
        assert score == 6

    def test_offline_qr_only_scores_four(self):
        score = assurance_score_from_verification_methods(
            [DEVICE, QR], integrity_vouched=False
        )
        assert score == 4

    def test_max_absent_below_high_threshold(self):
        score = assurance_score_from_verification_methods(
            [PASSKEY, DEVICE, BLE_STRONG, GPS, NETWORK],
            integrity_vouched=False,
        )
        assert score == 7
        assert score < 9


class TestComputeAssuranceBand:
    def test_high_band(self):
        assert compute_assurance_band(9, 5, 9) == "high"
        assert compute_assurance_band(12, 5, 9) == "high"

    def test_standard_band(self):
        assert compute_assurance_band(5, 5, 9) == "standard"
        assert compute_assurance_band(8, 5, 9) == "standard"

    def test_low_band(self):
        assert compute_assurance_band(4, 5, 9) == "low"
        assert compute_assurance_band(0, 5, 9) == "low"

    def test_offline_qr_is_low_under_default_thresholds(self):
        assert compute_assurance_band(4, 5, 9) == "low"

    def test_strong_ble_absent_is_standard_with_network(self):
        score = assurance_score_from_verification_methods(
            [BLE_STRONG, NETWORK], integrity_vouched=False
        )
        assert compute_assurance_band(score, 5, 9) == "standard"
