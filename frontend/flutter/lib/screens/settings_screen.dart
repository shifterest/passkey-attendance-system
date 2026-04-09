import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/services/api_client.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String? _userId;
  String? _deviceId;
  bool _piVouchExpiresSoon = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final userId = await SessionStore.getUserId();
    final deviceId = await SessionStore.getDeviceId();

    bool piVouchExpiresSoon = false;
    try {
      final sessionToken = await SessionStore.getSessionToken();
      if (sessionToken != null && sessionToken.isNotEmpty) {
        final client = ApiClient(Config.apiBaseUrl);
        final response = await client.get(
          ApiPaths.playIntegrityVouchStatus,
          {},
          extraHeaders: {'X-Session-Token': sessionToken},
        );
        if (response is Map<String, dynamic>) {
          piVouchExpiresSoon = response['expires_soon'] == true;
        }
      }
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _userId = userId;
      _deviceId = deviceId;
      _piVouchExpiresSoon = piVouchExpiresSoon;
    });
  }

  Widget _buildCard({
    required BuildContext context,
    required String title,
    required List<Widget> children,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final deviceIdLabel = _deviceId == null
        ? '—'
        : '${_deviceId!.substring(0, 8)}...';

    return Scaffold(
      appBar: AppBar(title: const Text(HomeStrings.settingsTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: [
          _buildCard(
            context: context,
            title: HomeStrings.accountLabel,
            children: [
              Text(HomeStrings.userId(_userId ?? '—')),
              const SizedBox(height: 6),
              Text('${HomeStrings.deviceIdLabel}: $deviceIdLabel'),
              const SizedBox(height: 6),
              const Text(HomeStrings.studentRoleLabel),
            ],
          ),
          const SizedBox(height: 16),
          _buildCard(
            context: context,
            title: HomeStrings.integrityTitle,
            children: [
              Text(
                _piVouchExpiresSoon
                    ? HomeStrings.integrityNeedsRefresh
                    : HomeStrings.integrityHealthy,
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildCard(
            context: context,
            title: HomeStrings.deviceTitle,
            children: const [
              Text(
                'Passkey authentication and device binding stay managed on this phone.',
              ),
              SizedBox(height: 6),
              Text(
                'Normal and offline check-in are now grouped under the Check-in destination.',
              ),
            ],
          ),
        ],
      ),
    );
  }
}
