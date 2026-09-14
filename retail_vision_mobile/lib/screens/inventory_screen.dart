import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_client.dart';
import '../theme/app_theme.dart';

class InventoryScreen extends StatelessWidget {
  const InventoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Discrepancy Matrix'),
      ),
      body: Consumer<ApiClient>(
        builder: (context, api, child) {
          if (api.isLoading && api.inventoryAlerts.isEmpty) {
            return const Center(child: CircularProgressIndicator(color: AppTheme.primaryBlue));
          }
          
          if (api.inventoryAlerts.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_outline, size: 48, color: AppTheme.successGreen),
                  SizedBox(height: 16),
                  Text('All Clear', style: TextStyle(color: AppTheme.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                  Text('No active discrepancies detected.', style: TextStyle(color: AppTheme.textSecondary)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: api.refreshAll,
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: api.inventoryAlerts.length,
              itemBuilder: (context, index) {
                final alert = api.inventoryAlerts[index];
                final sku = alert['sku'] ?? 'Unknown SKU';
                final alertType = alert['alert_type'] ?? 'Low Stock';
                final units = alert['current_units'] ?? 0;
                final id = alert['_id'] != null ? alert['_id'].toString().substring(alert['_id'].length - 6) : 'N/A';

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Alert ID: $id', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppTheme.alertRed.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(alertType.toString().toUpperCase(), style: const TextStyle(color: AppTheme.alertRed, fontSize: 9, fontWeight: FontWeight.bold)),
                            )
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(sku, style: const TextStyle(color: AppTheme.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.inventory, size: 16, color: AppTheme.textSecondary),
                            const SizedBox(width: 6),
                            Text('Physical Count: ', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                            Text('$units Units', style: const TextStyle(color: AppTheme.alertRed, fontSize: 13, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryBlue,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                            ),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Audit triggered for $sku')),
                              );
                            },
                            child: const Text('Trigger Audit'),
                          ),
                        )
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
