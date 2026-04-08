import 'session_store.dart';

class ClassCacheService {
  static const _cachedClassesKey = 'cached_classes';

  static Future<void> cacheClassData(
    String classId,
    dynamic schedule,
    List<String> studentIds,
  ) async {
    final prefs = SessionStore.prefs;
    final existing = prefs.getStringList(_cachedClassesKey) ?? [];
    if (!existing.contains(classId)) {
      existing.add(classId);
      await prefs.setStringList(_cachedClassesKey, existing);
    }
    await prefs.setString('class_schedule_$classId', schedule.toString());
    await prefs.setStringList('class_students_$classId', studentIds);
  }

  static List<String> getCachedClasses() {
    return SessionStore.prefs.getStringList(_cachedClassesKey) ?? [];
  }

  static List<String> getCachedStudents(String classId) {
    return SessionStore.prefs.getStringList('class_students_$classId') ?? [];
  }

  static Future<void> clearCache() async {
    final prefs = SessionStore.prefs;
    final classes = getCachedClasses();
    for (final classId in classes) {
      await prefs.remove('class_schedule_$classId');
      await prefs.remove('class_students_$classId');
    }
    await prefs.remove(_cachedClassesKey);
  }
}
