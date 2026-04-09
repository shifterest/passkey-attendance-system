import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/screens/authentication_screen.dart';
import 'package:passkey_attendance_system/screens/check_in_result_screen.dart';
import 'package:passkey_attendance_system/screens/offline_check_in_screen.dart';
import 'package:passkey_attendance_system/screens/registration_screen.dart';
import 'package:passkey_attendance_system/screens/qr_scanner_screen.dart';
import 'package:passkey_attendance_system/screens/settings_screen.dart';
import 'package:passkey_attendance_system/screens/web_login_scanner_screen.dart';
import 'package:passkey_attendance_system/screens/teacher_dashboard_screen.dart';
import 'package:passkey_attendance_system/screens/teacher_home_screen.dart';
import 'package:passkey_attendance_system/screens/attendance_history_screen.dart';
import 'package:passkey_attendance_system/screens/teacher_offline_scanner_screen.dart';
import 'package:passkey_attendance_system/screens/teacher_offline_session_screen.dart';
import 'package:passkey_attendance_system/screens/teacher_session_screen.dart';
import 'package:passkey_attendance_system/screens/student_shell.dart';

import 'config/config.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/session_store.dart';
import 'theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final appLinks = AppLinks();

  try {
    await Config.init();
    await SessionStore.init();
    runApp(Main(appLinks));
  } catch (e, stackTrace) {
    debugPrint('Error during initialization: $e');
    debugPrint('Stack trace: $stackTrace');
    runApp(ErrorApp(error: e.toString()));
  }
}

// Routes deep links
CustomTransitionPage<void> _transitionPage(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    transitionDuration: const Duration(milliseconds: 280),
    reverseTransitionDuration: const Duration(milliseconds: 220),
    child: child,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final primary = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      final secondary = CurvedAnimation(
        parent: secondaryAnimation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      final incoming = Tween<Offset>(
        begin: const Offset(1, 0),
        end: Offset.zero,
      ).animate(primary);
      final outgoing = Tween<Offset>(
        begin: Offset.zero,
        end: const Offset(-0.08, 0),
      ).animate(secondary);
      return SlideTransition(
        position: outgoing,
        child: SlideTransition(position: incoming, child: child),
      );
    },
  );
}

final _router = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => const AuthWrapper()),
    GoRoute(
      path: '/scan',
      pageBuilder: (context, state) =>
          _transitionPage(state, const QrScannerScreen()),
    ),
    GoRoute(
      path: '/web-login-scan',
      pageBuilder: (context, state) =>
          _transitionPage(state, const WebLoginScannerScreen()),
    ),
    GoRoute(
      path: '/authenticate',
      pageBuilder: (context, state) {
        final userId = state.uri.queryParameters['user_id'];
        final login = state.uri.queryParameters['login'] == 'true';
        final webLoginToken = state.uri.queryParameters['web_login_token'];
        if (userId == null || userId.isEmpty) {
          return _transitionPage(state, const LoginScreen());
        }
        return _transitionPage(
          state,
          AuthenticationScreen(
            userId: userId,
            login: login,
            webLoginToken: webLoginToken,
          ),
        );
      },
    ),
    GoRoute(
      path: '/register',
      pageBuilder: (context, state) => _transitionPage(
        state,
        RegistrationScreen(
          registrationToken: state.uri.queryParameters['token'] ?? '',
          userId: state.uri.queryParameters['user_id'] ?? '',
        ),
      ),
    ),
    GoRoute(
      path: '/check-in-result',
      pageBuilder: (context, state) {
        final record = state.extra;
        if (record is! Map<String, dynamic>) {
          return _transitionPage(state, const HomeScreen());
        }
        return _transitionPage(state, CheckInResultScreen(record: record));
      },
    ),
    GoRoute(
      path: '/offline-check-in',
      pageBuilder: (context, state) =>
          _transitionPage(state, const OfflineCheckInScreen()),
    ),
    GoRoute(
      path: '/history',
      pageBuilder: (context, state) =>
          _transitionPage(state, const AttendanceHistoryScreen()),
    ),
    GoRoute(
      path: '/settings',
      pageBuilder: (context, state) =>
          _transitionPage(state, const SettingsScreen()),
    ),
    GoRoute(
      path: '/teacher',
      builder: (context, state) => const TeacherHomeScreen(),
    ),
    GoRoute(
      path: '/teacher/session/:id',
      builder: (context, state) {
        final sessionId = state.pathParameters['id'] ?? '';
        return TeacherSessionScreen(sessionId: sessionId);
      },
    ),
    GoRoute(
      path: '/teacher/session/:id/roster',
      builder: (context, state) {
        final sessionId = state.pathParameters['id'] ?? '';
        return TeacherDashboardScreen(sessionId: sessionId);
      },
    ),
    GoRoute(
      path: '/teacher/offline',
      builder: (context, state) => const TeacherOfflineSessionScreen(),
    ),
    GoRoute(
      path: '/teacher/offline/scan',
      builder: (context, state) {
        final extra = state.extra as Map<String, dynamic>? ?? {};
        return TeacherOfflineScannerScreen(
          sessionId: extra['session_id'] as String? ?? '',
          nonce: extra['nonce'] as String? ?? '',
          classId: extra['class_id'] as String? ?? '',
        );
      },
    ),
  ],
);

// Error screen for initialization failures
class ErrorApp extends StatelessWidget {
  const ErrorApp({super.key, required this.error});

  final String error;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                const Text(
                  'Initialization Error',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  error,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Routes between login and home
class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: SessionStore.sessionRevision,
      builder: (context, revision, _) => FutureBuilder<bool>(
        key: ValueKey(revision),
        future: SessionStore.isSessionValid(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (snapshot.data != true) {
            return const LoginScreen();
          }
          final role = SessionStore.getRole();
          if (role == 'teacher') {
            return const TeacherHomeScreen();
          }
          return const StudentShell();
        },
      ),
    );
  }
}

class Main extends StatefulWidget {
  const Main(this.appLinks, {super.key});

  final AppLinks appLinks;

  @override
  State<Main> createState() => _MainState();
}

class _MainState extends State<Main> {
  late final StreamSubscription<Uri> sub;

  void _routeUri(Uri? uri) {
    if (uri == null) return;

    if (uri.scheme != Config.registrationProtocol) return;
    if (uri.host != 'register') return;

    final token = uri.queryParameters['token'];
    final userId = uri.queryParameters['user_id'];
    if (token == null || userId == null) return;

    try {
      _router.go(
        '/register?token=${Uri.encodeComponent(token)}&user_id=${Uri.encodeComponent(userId)}',
      );
    } catch (e) {
      debugPrint('Error navigating to register: $e');
    }
  }

  @override
  void initState() {
    super.initState();

    // All I know is that WidgetsBinding.instance.addPostFrameCallback waits for
    // the first frame to render before doing stuff
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.appLinks.getInitialLink().then((uri) {
        _routeUri(uri);
      });
    });

    sub = widget.appLinks.uriLinkStream.listen((uri) {
      _routeUri(uri);
    });
  }

  @override
  void dispose() {
    sub.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      routerConfig: _router,
    );
  }
}
