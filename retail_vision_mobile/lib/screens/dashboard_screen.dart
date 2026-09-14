import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_client.dart';
import '../theme/app_theme.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Initial fetch
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ApiClient>().refreshAll();
    });
    // Auto-refresh every 5 seconds
    _timer = Timer.periodic(const Duration(seconds: 5), (timer) {
      context.read<ApiClient>().refreshAll();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Store Overview'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppTheme.primaryBlue),
            onPressed: () => context.read<ApiClient>().refreshAll(),
          )
        ],
      ),
      body: Consumer<ApiClient>(
        builder: (context, api, child) {
          final totalEntry = api.footfallData['ENTRY'] ?? 0;
          final totalExit = api.footfallData['EXIT'] ?? 0;
          final occupancy = (totalEntry - totalExit).clamp(0, 99999);
          
          final queueCount = api.queueStatus['checkout_count'] ?? 0;
          final qStatus = api.queueStatus['status'] ?? 'normal';
          
          return RefreshIndicator(
            onRefresh: api.refreshAll,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (api.isError)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppTheme.alertRed.withOpacity(0.15),
                      border: Border.all(color: AppTheme.alertRed.withOpacity(0.5)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.error_outline, color: AppTheme.alertRed),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Connection Error. Please check your network or ensure the backend is running.',
                            style: TextStyle(color: AppTheme.alertRed, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),

                const Text('LIVE FOOTFALL', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _buildMetricCard('Current Occupancy', '$occupancy', AppTheme.successGreen, Icons.people)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildMetricCard('Total Entries', '$totalEntry', AppTheme.primaryBlue, Icons.login)),
                  ],
                ),
                
                const SizedBox(height: 24),
                const Text('CHECKOUT STATUS', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                const SizedBox(height: 12),
                _buildQueueCard(queueCount, qStatus, api.queueStatus['avg_wait']?.toStringAsFixed(1) ?? '0.0'),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, Color accent, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: accent),
                const SizedBox(width: 8),
                Text(title, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 12),
            Text(value, style: TextStyle(color: accent, fontSize: 28, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }

  Widget _buildQueueCard(int count, String status, String waitTime) {
    final isHigh = status.toLowerCase() == 'high';
    final accent = isHigh ? AppTheme.alertRed : AppTheme.successGreen;
    
    return Card(
      child: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: accent, width: 3)),
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Queue Depth', style: TextStyle(color: AppTheme.textSecondary)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: accent.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(status.toUpperCase(), style: TextStyle(color: accent, fontSize: 10, fontWeight: FontWeight.bold)),
                )
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Text('$count', style: TextStyle(color: accent, fontSize: 32, fontWeight: FontWeight.w800)),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Persons waiting', style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600)),
                    Text('Avg wait: $waitTime min', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                  ],
                )
              ],
            )
          ],
        ),
      ),
    );
  }
}
