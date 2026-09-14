import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiClient extends ChangeNotifier {
  // Use 10.0.2.2 for Android Emulator, or 127.0.0.1 for physical device with adb reverse
  static String get baseUrl {
    if (!kIsWeb && Platform.isAndroid) {
      // 10.0.2.2 is the default IP for Android emulator to access host localhost.
      // If using a physical device over USB, run: adb reverse tcp:8000 tcp:8000
      // and use 127.0.0.1. Let's use 127.0.0.1 by default for physical ADB reverse.
      // If it fails, they can change this to their local network IP (e.g. 192.168.1.X)
      return 'http://127.0.0.1:8000';
    }
    return 'http://127.0.0.1:8000';
  }

  Map<String, dynamic> footfallData = {"ENTRY": 0, "EXIT": 0};
  Map<String, dynamic> queueStatus = {"status": "normal", "checkout_count": 0};
  List<dynamic> inventoryAlerts = [];
  bool isLoading = false;
  bool isError = false;

  Future<void> refreshAll() async {
    isLoading = true;
    isError = false;
    notifyListeners();

    try {
      final footfallRes = await http.get(Uri.parse('$baseUrl/api/metrics/footfall')).timeout(const Duration(seconds: 5));
      if (footfallRes.statusCode == 200) {
        footfallData = jsonDecode(footfallRes.body);
      }

      final queueRes = await http.get(Uri.parse('$baseUrl/api/queue/status')).timeout(const Duration(seconds: 5));
      if (queueRes.statusCode == 200) {
        queueStatus = jsonDecode(queueRes.body);
      }

      final alertsRes = await http.get(Uri.parse('$baseUrl/api/inventory/warehouse/alerts')).timeout(const Duration(seconds: 5));
      if (alertsRes.statusCode == 200) {
        final data = jsonDecode(alertsRes.body);
        inventoryAlerts = data['alerts'] ?? [];
      }
    } catch (e) {
      debugPrint("API Error: $e");
      isError = true;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }
}
