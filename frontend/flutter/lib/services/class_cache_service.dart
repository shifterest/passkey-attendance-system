import 'package:shared_preferences/shared_preferences.dart';

class ClassCacheService {
  static const _cachedClassesKey = 'cached_classes';

  static Future<SharedPreferences> _prefs() => SharedPreferences.getInstance();

  static Future<void> cacheClassData(
    String classId,
    dynamic schedule,
    List<String> studentIds,
  ) async {
    final prefs = await _prefs();
    final existing = prefs.getStringList(_cachedClassesKey) ?? [];
    if (!existing.contains(classId)) {
      existing.add(classId);
      await prefs.setStringList(_cachedClassesKey, existing);
    }
    await prefs.setString('class_schedule_$classId', schedule.toString());
    await prefs.setStringList('class_students_$classId', studentIds);
  }

  static Future<List<String>> getCachedClasses() async {
    final prefs = await _prefs();
    return prefs.getStringList(_cachedClassesKey) ?? [];
  }

  static Future<List<String>> getCachedStudents(String classId) async {
    final prefs = await _prefs();
    return prefs.getStringList('class_students_$classId') ?? [];
  }

  static Future<void> clearCache() async {
    final prefs = await _prefs();
    final classes = prefs.getStringList(_cachedClassesKey) ?? [];
    for (final classId in classes) {
      await prefs.remove('class_schedule_$classId');
      await prefs.remove('class_students_$classId');
    }
    await prefs.remove(_cachedClassesKey);
  }
}
