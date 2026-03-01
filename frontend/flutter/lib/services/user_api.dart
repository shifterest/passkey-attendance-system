import 'api_client.dart';
import '../config/config.dart';

class UserApi {
  Future<Map<String, dynamic>> getUser(String userId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    return client.get('/users/$userId', {});
  }

  Future<Map<String, dynamic>> updateUser(
    String userId,
    Map<String, dynamic> updatedData,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    return client.put('/users/$userId', updatedData);
  }
}
