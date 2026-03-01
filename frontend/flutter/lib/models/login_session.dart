class LoginSession {
  String userId;
  String sessionToken;
  int expiresIn;

  LoginSession({
    required this.userId,
    required this.sessionToken,
    required this.expiresIn,
  });

  static LoginSession fromJson(Map<String, dynamic> json) {
    return LoginSession(
      userId: json['user_id'],
      sessionToken: json['session_token'],
      expiresIn: json['expires_in'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'session_token': sessionToken,
      'expires_in': expiresIn,
    };
  }
}
