import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiClient {
  final String apiBaseUrl;

  ApiClient(this.apiBaseUrl);

  Future<dynamic> get(String path, Map body) async {
    try {
      final response = await http.get(
        Uri.parse('$apiBaseUrl$path'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        dynamic decodedResponse = jsonDecode(response.body);
        if (decodedResponse is String) {
          return jsonDecode(decodedResponse);
        } else {
          return decodedResponse;
        }
      } else if (response.statusCode == 204) {
        return {};
      } else {
        throw Exception(
          'Failed to GET (${response.statusCode}): ${response.body}',
        );
      }
    } catch (e) {
      throw Exception('API error: $e');
    }
  }

  Future<dynamic> post(String path, Map body) async {
    try {
      final response = await http.post(
        Uri.parse('$apiBaseUrl$path'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        dynamic decodedResponse = jsonDecode(response.body);
        if (decodedResponse is String) {
          return jsonDecode(decodedResponse);
        } else {
          return decodedResponse;
        }
      } else if (response.statusCode == 204) {
        return {};
      } else {
        throw Exception(
          'Failed to POST (${response.statusCode}): ${response.body}',
        );
      }
    } catch (e) {
      throw Exception('API error: $e');
    }
  }

  Future<dynamic> put(String path, Map body) async {
    try {
      final response = await http.put(
        Uri.parse('$apiBaseUrl$path'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        dynamic decodedResponse = jsonDecode(response.body);
        if (decodedResponse is String) {
          return jsonDecode(decodedResponse);
        } else {
          return decodedResponse;
        }
      } else if (response.statusCode == 204) {
        return {};
      } else {
        throw Exception(
          'Failed to PUT (${response.statusCode}): ${response.body}',
        );
      }
    } catch (e) {
      throw Exception('API error: $e');
    }
  }

  Future<dynamic> delete(String path, Map body) async {
    try {
      final response = await http.delete(
        Uri.parse('$apiBaseUrl$path'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        dynamic decodedResponse = jsonDecode(response.body);
        if (decodedResponse is String) {
          return jsonDecode(decodedResponse);
        } else {
          return decodedResponse;
        }
      } else if (response.statusCode == 204) {
        return {};
      } else {
        throw Exception(
          'Failed to DELETE (${response.statusCode}): ${response.body}',
        );
      }
    } catch (e) {
      throw Exception('API error: $e');
    }
  }
}
