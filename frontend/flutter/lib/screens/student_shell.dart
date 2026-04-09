import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/screens/attendance_history_screen.dart';
import 'package:passkey_attendance_system/screens/home_screen.dart';
import 'package:passkey_attendance_system/screens/offline_check_in_screen.dart';
import 'package:passkey_attendance_system/strings.dart';

class StudentShell extends StatefulWidget {
  const StudentShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  State<StudentShell> createState() => _StudentShellState();
}

class _StudentShellState extends State<StudentShell> {
  late int _selectedIndex;

  @override
  void initState() {
    super.initState();
    _selectedIndex = widget.initialIndex;
  }

  void _selectTab(int index) {
    if (_selectedIndex == index) {
      return;
    }
    setState(() => _selectedIndex = index);
  }

  Widget _buildSelectedTab() {
    return switch (_selectedIndex) {
      1 => const AttendanceHistoryScreen(embedded: true),
      2 => OfflineCheckInScreen(
        embedded: true,
        onReturnToDashboard: () => _selectTab(0),
      ),
      _ => HomeScreen(
        embedded: true,
        onOpenHistory: () => _selectTab(1),
        onOpenOffline: () => _selectTab(2),
      ),
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 240),
        child: KeyedSubtree(
          key: ValueKey(_selectedIndex),
          child: _buildSelectedTab(),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: _selectTab,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard_rounded),
            label: HomeStrings.dashboardTab,
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history_rounded),
            label: HomeStrings.historyTab,
          ),
          NavigationDestination(
            icon: Icon(Icons.wifi_off_outlined),
            selectedIcon: Icon(Icons.wifi_off_rounded),
            label: HomeStrings.offlineTab,
          ),
        ],
      ),
    );
  }
}
