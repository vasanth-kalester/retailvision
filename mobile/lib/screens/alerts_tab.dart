import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';

class AlertsTab extends StatefulWidget {
  const AlertsTab({super.key});

  @override
  State<AlertsTab> createState() => _AlertsTabState();
}

class _AlertsTabState extends State<AlertsTab> {
  List<Map<String, dynamic>> _alerts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchAlerts();
  }

  Future<void> _fetchAlerts() async {
    setState(() => _loading = true);
    try {
      final res = await Supabase.instance.client
          .from('alert_history')
          .select()
          .eq('store_id', 'store_104')
          .order('created_at', ascending: false)
          .limit(50);

      _alerts = List<Map<String, dynamic>>.from(res);
    } catch (e) {
      debugPrint('Alerts fetch error: $e');
    }
    if (mounted) setState(() => _loading = false);
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'loitering': return Icons.warning_amber;
      case 'queue_surge': return Icons.people;
      case 'out_of_stock': return Icons.inventory;
      default: return Icons.info_outline;
    }
  }

  Color _colorForSeverity(String severity) {
    switch (severity) {
      case 'high': return const Color(0xFFE11D48);
      case 'medium': return const Color(0xFFD97706);
      default: return const Color(0xFF2563EB);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_loading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _fetchAlerts,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Alert History', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('${_alerts.length} alerts from the edge device',
                    style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey)),
              ],
            ),
          ),

          Expanded(
            child: _alerts.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle_outline, size: 48, color: Colors.green.shade300),
                        const SizedBox(height: 12),
                        Text('No alerts', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                        Text('All systems operating normally', style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _alerts.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final alert = _alerts[index];
                      final type = (alert['alert_type'] ?? 'unknown') as String;
                      final severity = (alert['severity'] ?? 'medium') as String;
                      final desc = (alert['description'] ?? '') as String;
                      final color = _colorForSeverity(severity);

                      String timeAgo = '';
                      try {
                        final dt = DateTime.parse(alert['created_at']);
                        timeAgo = DateFormat('MMM d, HH:mm').format(dt.toLocal());
                      } catch (_) {}

                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.grey.shade200),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4, offset: const Offset(0, 2)),
                          ],
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Severity icon
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: color.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(_iconForType(type), size: 20, color: color),
                            ),
                            const SizedBox(width: 12),
                            // Content
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: color.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          severity.toUpperCase(),
                                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.5),
                                        ),
                                      ),
                                      const Spacer(),
                                      Text(timeAgo, style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    type.replaceAll('_', ' ').toUpperCase(),
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                  ),
                                  if (desc.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(desc, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
