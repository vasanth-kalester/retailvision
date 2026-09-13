import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:fl_chart/fl_chart.dart';

class FootfallTab extends StatefulWidget {
  const FootfallTab({super.key});

  @override
  State<FootfallTab> createState() => _FootfallTabState();
}

class _FootfallTabState extends State<FootfallTab> {
  List<Map<String, dynamic>> _hourlyData = [];
  bool _loading = true;
  int _totalEntries = 0;
  int _totalExits = 0;

  @override
  void initState() {
    super.initState();
    _fetchFootfall();
  }

  Future<void> _fetchFootfall() async {
    setState(() => _loading = true);
    try {
      final now = DateTime.now();
      final todayStart = DateTime(now.year, now.month, now.day).toUtc().toIso8601String();

      final res = await Supabase.instance.client
          .from('hourly_footfall')
          .select()
          .eq('store_id', 'store_104')
          .gte('hour_start', todayStart)
          .order('hour_start', ascending: true);

      _hourlyData = List<Map<String, dynamic>>.from(res);
      _totalEntries = 0;
      _totalExits = 0;
      for (final row in _hourlyData) {
        _totalEntries += (row['entries'] as int?) ?? 0;
        _totalExits += (row['exits'] as int?) ?? 0;
      }
    } catch (e) {
      debugPrint('Footfall fetch error: $e');
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_loading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _fetchFootfall,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Footfall Analytics', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('Hourly entry/exit counts synced from edge device', style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey)),
          const SizedBox(height: 20),

          // Summary row
          Row(
            children: [
              Expanded(
                child: _SummaryCard(
                  label: 'TOTAL ENTRIES',
                  value: _totalEntries.toString(),
                  color: const Color(0xFF2563EB),
                  icon: Icons.login,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryCard(
                  label: 'TOTAL EXITS',
                  value: _totalExits.toString(),
                  color: const Color(0xFF64748B),
                  icon: Icons.logout,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryCard(
                  label: 'NET IN-STORE',
                  value: (_totalEntries - _totalExits).clamp(0, 9999).toString(),
                  color: const Color(0xFF059669),
                  icon: Icons.people,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Chart
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Hourly Breakdown', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      _LegendDot(color: const Color(0xFF2563EB), label: 'Entries'),
                      const SizedBox(width: 16),
                      _LegendDot(color: const Color(0xFF94A3B8), label: 'Exits'),
                    ],
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 220,
                    child: _hourlyData.isEmpty
                        ? Center(
                            child: Text('No data synced yet',
                                style: TextStyle(color: Colors.grey.shade400)))
                        : BarChart(
                            BarChartData(
                              barTouchData: BarTouchData(enabled: true),
                              titlesData: FlTitlesData(
                                show: true,
                                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                bottomTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    getTitlesWidget: (val, meta) {
                                      final idx = val.toInt();
                                      if (idx < 0 || idx >= _hourlyData.length) return const SizedBox();
                                      final hourStr = _hourlyData[idx]['hour_start'] ?? '';
                                      try {
                                        final dt = DateTime.parse(hourStr);
                                        return Padding(
                                          padding: const EdgeInsets.only(top: 6),
                                          child: Text('${dt.hour}h', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                        );
                                      } catch (_) {
                                        return const SizedBox();
                                      }
                                    },
                                  ),
                                ),
                              ),
                              gridData: FlGridData(
                                show: true,
                                drawVerticalLine: false,
                                horizontalInterval: 10,
                                getDrawingHorizontalLine: (_) => FlLine(color: Colors.grey.shade200, strokeWidth: 1),
                              ),
                              borderData: FlBorderData(show: false),
                              barGroups: List.generate(_hourlyData.length, (i) {
                                final row = _hourlyData[i];
                                return BarChartGroupData(
                                  x: i,
                                  barRods: [
                                    BarChartRodData(
                                      toY: ((row['entries'] ?? 0) as int).toDouble(),
                                      color: const Color(0xFF2563EB),
                                      width: 8,
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                                    ),
                                    BarChartRodData(
                                      toY: ((row['exits'] ?? 0) as int).toDouble(),
                                      color: const Color(0xFF94A3B8),
                                      width: 8,
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                                    ),
                                  ],
                                );
                              }),
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String label, value;
  final Color color;
  final IconData icon;

  const _SummaryCard({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
          Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.grey.shade500, letterSpacing: 0.5)),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
      ],
    );
  }
}
