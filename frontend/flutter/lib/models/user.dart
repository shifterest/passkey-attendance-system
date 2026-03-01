class User {
  String id;
  String role;
  String fullName;
  String email;
  String schoolId;

  User({
    required this.id,
    required this.role,
    required this.fullName,
    required this.email,
    required this.schoolId,
  });

  static User fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      role: json['role'],
      fullName: json['full_name'],
      email: json['email'],
      schoolId: json['school_id'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'role': role,
      'full_name': fullName,
      'email': email,
      'school_id': schoolId,
    };
  }
}
