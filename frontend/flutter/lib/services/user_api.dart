import 'api_client.dart';
import '../config/config.dart';

class UserApi {
  Future<Map<String, dynamic>> getUser(String userId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic user = await client.get('/users/$userId', {});
    if (user is Map<String, dynamic>) {
      return user;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  Future<Map<String, dynamic>> updateUser(
    String userId,
    Map<String, dynamic> updatedData,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic updatedUser = await client.put('/users/$userId', updatedData);
    if (updatedUser is Map<String, dynamic>) {
      return updatedUser;
    } else {
      throw Exception('Invalid response from server');
    }
  }
}
