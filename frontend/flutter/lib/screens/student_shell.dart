import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _selectedIndex = widget.initialIndex;
    _pageController = PageController(initialPage: _selectedIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _selectTab(int index) {
    if (_selectedIndex == index) {
      return;
    }
    setState(() => _selectedIndex = index);
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final immersive = _selectedIndex == 1;
    final isDark = immersive || theme.brightness == Brightness.dark;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: (isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark)
          .copyWith(
            statusBarColor: immersive ? Colors.black : Colors.transparent,
            systemNavigationBarColor: immersive
                ? Colors.black
                : theme.colorScheme.surface,
            systemNavigationBarDividerColor: immersive
                ? Colors.black
                : theme.colorScheme.surface,
          ),
      child: Scaffold(
        backgroundColor: immersive ? Colors.black : theme.colorScheme.surface,
        body: PageView(
          controller: _pageController,
          physics: const NeverScrollableScrollPhysics(),
          onPageChanged: (index) {
            if (_selectedIndex != index) {
              setState(() => _selectedIndex = index);
            }
          },
          children: [
            HomeScreen(embedded: true, onOpenCheckIn: () => _selectTab(1)),
            CheckInHubScreen(embedded: true, active: _selectedIndex == 1),
            const AttendanceHistoryScreen(embedded: true),
          ],
        ),
        bottomNavigationBar: NavigationBarTheme(
          data: NavigationBarThemeData(
            backgroundColor: immersive ? Colors.black : null,
            indicatorColor: immersive
                ? Colors.white.withValues(alpha: 0.12)
                : theme.colorScheme.primary.withValues(alpha: 0.12),
            labelTextStyle: WidgetStateProperty.resolveWith((states) {
              final selected = states.contains(WidgetState.selected);
              return theme.textTheme.labelMedium?.copyWith(
                color: immersive
                    ? (selected ? Colors.white : Colors.white70)
                    : null,
              );
            }),
            iconTheme: WidgetStateProperty.resolveWith((states) {
              final selected = states.contains(WidgetState.selected);
              return IconThemeData(
                color: immersive
                    ? (selected ? Colors.white : Colors.white70)
                    : (selected
                          ? theme.colorScheme.primary
                          : theme.colorScheme.onSurfaceVariant),
              );
            }),
          ),
          child: NavigationBar(
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
        ),
      ),
    );
  }
}
