import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  int _totalFootfall = 0;
  int _activeShoppers = 0;
  int _lowStockCount = 0;
  int _alertCount = 0;
  double _avgWait = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchDashboardData();
  }

  Future<void> _fetchDashboardData() async {
    setState(() => _loading = true);
    final supabase = Supabase.instance.client;

    try {
      // Footfall (today)
      final now = DateTime.now();
      final todayStart = DateTime(now.year, now.month, now.day).toUtc().toIso8601String();

      final footfallRes = await supabase
          .from('hourly_footfall')
          .select('entries, exits')
          .gte('hour_start', todayStart)
          .eq('store_id', 'store_104');

      int entries = 0;
      int exits = 0;
      for (final row in footfallRes) {
        entries += (row['entries'] as int?) ?? 0;
        exits += (row['exits'] as int?) ?? 0;
      }
      _totalFootfall = entries;
      _activeShoppers = (entries - exits).clamp(0, 9999);

      // Inventory alerts
      final invRes = await supabase
          .from('inventory_snapshots')
          .select()
          .eq('store_id', 'store_104');

      _lowStockCount = 0;
      for (final row in invRes) {
        if ((row['total_units'] ?? 0) <= (row['reorder_point'] ?? 0)) {
          _lowStockCount++;
        }
      }

      // Alerts count (last 24h)
      final alertsRes = await supabase
          .from('alert_history')
          .select('id')
          .eq('store_id', 'store_104')
          .gte('created_at', now.subtract(const Duration(hours: 24)).toUtc().toIso8601String());

      _alertCount = alertsRes.length;

      // Queue stats (latest hour)
      final queueRes = await supabase
          .from('hourly_queue_stats')
          .select()
          .eq('store_id', 'store_104')
          .order('hour_start', ascending: false)
          .limit(1);

      if (queueRes.isNotEmpty) {
        _avgWait = (queueRes[0]['avg_wait_minutes'] ?? 0).toDouble();
      }
    } catch (e) {
      debugPrint('Dashboard fetch error: $e');
    }

    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: _fetchDashboardData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Status badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Row(
              children: [
                Container(
                  width: 8, height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF2563EB),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'EDGE NODE #04 ACTIVE • Store Sync: Real-time',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF2563EB),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // KPI Grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.4,
            children: [
              _KpiCard(
                label: 'STORE FOOTFALL',
                value: _totalFootfall.toString(),
                subtitle: 'Today',
                icon: Icons.people,
                color: const Color(0xFF2563EB),
              ),
              _KpiCard(
                label: 'ACTIVE SHOPPERS',
                value: _activeShoppers.toString(),
                subtitle: 'Currently in store',
                icon: Icons.shopping_cart,
                color: const Color(0xFF059669),
              ),
              _KpiCard(
                label: 'LOW STOCK',
                value: _lowStockCount.toString(),
                subtitle: 'SKUs below threshold',
                icon: Icons.inventory,
                color: _lowStockCount > 0 ? const Color(0xFFD97706) : const Color(0xFF059669),
                alert: _lowStockCount > 0,
              ),
              _KpiCard(
                label: 'AVG WAIT TIME',
                value: '${_avgWait.toStringAsFixed(1)}m',
                subtitle: 'Checkout queue',
                icon: Icons.timer,
                color: _avgWait > 3.0 ? const Color(0xFFE11D48) : const Color(0xFF2563EB),
                alert: _avgWait > 3.0,
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Alert Summary
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.notifications_active,
                          color: _alertCount > 0 ? const Color(0xFFE11D48) : Colors.grey,
                          size: 20),
                      const SizedBox(width: 8),
                      Text('Active Incidents (24h)',
                          style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: _alertCount > 0 ? const Color(0xFFFFE4E6) : const Color(0xFFD1FAE5),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          _alertCount > 0 ? '$_alertCount Unresolved' : 'All Clear',
                          style: TextStyle(
                            color: _alertCount > 0 ? const Color(0xFFE11D48) : const Color(0xFF059669),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Privacy Badge
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.shield, color: Colors.grey.shade400, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Privacy Protected: Only aggregated analytics are synced. No raw video or biometric data leaves the edge device.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.grey.shade600,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;
  final bool alert;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
    this.alert = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(label,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Colors.grey.shade500,
                      letterSpacing: 0.5,
                    ),
                    overflow: TextOverflow.ellipsis),
              ),
              Icon(icon, size: 16, color: color),
            ],
          ),
          Text(value,
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: color,
              )),
          Text(subtitle,
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade500,
              )),
        ],
      ),
    );
  }
}
