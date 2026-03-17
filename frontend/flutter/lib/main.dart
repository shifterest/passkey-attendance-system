import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart' hide Config;
import 'package:passkey_attendance_system/screens/registration_screen.dart';

import 'config/config.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/play_integrity_service.dart';
import 'services/session_store.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final appLinks = AppLinks();

  try {
    await Config.init();
    await SessionStore.init();
    unawaited(submitPlayIntegrityVouch());
    runApp(Main(appLinks));
  } catch (e, stackTrace) {
    debugPrint('Error during initialization: $e');
    debugPrint('Stack trace: $stackTrace');
    runApp(ErrorApp(error: e.toString()));
  }
}

// Routes deep links
final _router = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => const AuthWrapper()),
    GoRoute(
      path: '/register',
      builder: (context, state) => RegistrationScreen(
        registrationToken: state.uri.queryParameters['token'] ?? '',
        userId: state.uri.queryParameters['user_id'] ?? '',
      ),
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
    return FutureBuilder<bool>(
      future: SessionStore.isSessionValid(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return snapshot.data == true ? const HomeScreen() : const LoginScreen();
      },
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
      theme: ThemeData(
        useMaterial3: true,
        textTheme: GoogleFonts.googleSansFlexTextTheme(),
      ),
      darkTheme: ThemeData.dark(useMaterial3: true).copyWith(
        textTheme: GoogleFonts.googleSansFlexTextTheme(
          ThemeData.dark().textTheme,
        ),
      ),
      routerConfig: _router,
    );
  }
}
