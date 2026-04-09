import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/screens/attendance_history_screen.dart';
import 'package:passkey_attendance_system/screens/check_in_hub_screen.dart';
import 'package:passkey_attendance_system/screens/home_screen.dart';
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
      1 => const CheckInHubScreen(embedded: true),
      2 => const AttendanceHistoryScreen(embedded: true),
      _ => HomeScreen(embedded: true, onOpenCheckIn: () => _selectTab(1)),
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
            icon: Icon(Icons.how_to_reg_outlined),
            selectedIcon: Icon(Icons.how_to_reg_rounded),
            label: HomeStrings.checkInTab,
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history_rounded),
            label: HomeStrings.historyTab,
          ),
        ],
      ),
    );
  }
}
