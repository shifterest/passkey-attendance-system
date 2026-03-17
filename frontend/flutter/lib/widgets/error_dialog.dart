import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

Future<void> showErrorDialog(
  BuildContext context,
  String? error, {
  String? title,
  String? body,
}) {
  return showDialog<void>(
    context: context,
    builder: (BuildContext context) {
      return AlertDialog(
        title: Text(title ?? 'Error'),
        content: Text(
          '${body ?? 'Something went wrong. Please try again.'}\n\n$error',
        ),
        actions: <Widget>[
          TextButton(
            style: TextButton.styleFrom(
              textStyle: Theme.of(context).textTheme.labelLarge,
            ),
            child: const Text('Return'),
            onPressed: () {
              Navigator.of(context).pop();
              GoRouter.of(context).go('/');
            },
          ),
        ],
      );
    },
  );
}
