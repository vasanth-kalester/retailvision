import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class InventoryTab extends StatefulWidget {
  const InventoryTab({super.key});

  @override
  State<InventoryTab> createState() => _InventoryTabState();
}

class _InventoryTabState extends State<InventoryTab> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String _filter = 'all'; // 'all', 'low', 'ok'

  @override
  void initState() {
    super.initState();
    _fetchInventory();
  }

  Future<void> _fetchInventory() async {
    setState(() => _loading = true);
    try {
      final res = await Supabase.instance.client
          .from('inventory_snapshots')
          .select()
          .eq('store_id', 'store_104')
          .order('sku', ascending: true);

      _items = List<Map<String, dynamic>>.from(res);
    } catch (e) {
      debugPrint('Inventory fetch error: $e');
    }
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filteredItems {
    if (_filter == 'low') {
      return _items.where((i) => (i['total_units'] ?? 0) <= (i['reorder_point'] ?? 0)).toList();
    } else if (_filter == 'ok') {
      return _items.where((i) => (i['total_units'] ?? 0) > (i['reorder_point'] ?? 0)).toList();
    }
    return _items;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_loading) return const Center(child: CircularProgressIndicator());

    final lowCount = _items.where((i) => (i['total_units'] ?? 0) <= (i['reorder_point'] ?? 0)).length;

    return RefreshIndicator(
      onRefresh: _fetchInventory,
      child: Column(
        children: [
          // Header + Filters
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Inventory Status', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('${_items.length} SKUs tracked • $lowCount below reorder point',
                    style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _FilterChip(label: 'All (${_items.length})', active: _filter == 'all', onTap: () => setState(() => _filter = 'all')),
                    const SizedBox(width: 8),
                    _FilterChip(label: 'Low Stock ($lowCount)', active: _filter == 'low', onTap: () => setState(() => _filter = 'low'), alertColor: const Color(0xFFE11D48)),
                    const SizedBox(width: 8),
                    _FilterChip(label: 'In Stock', active: _filter == 'ok', onTap: () => setState(() => _filter = 'ok')),
                  ],
                ),
              ],
            ),
          ),

          // List
          Expanded(
            child: _filteredItems.isEmpty
                ? Center(child: Text('No items match this filter', style: TextStyle(color: Colors.grey.shade400)))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _filteredItems.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final item = _filteredItems[index];
                      final units = (item['total_units'] ?? 0) as int;
                      final reorder = (item['reorder_point'] ?? 0) as int;
                      final safety = (item['safety_stock'] ?? 0) as int;
                      final isLow = units <= reorder;
                      final isEmpty = units == 0;

                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isEmpty
                                ? const Color(0xFFE11D48).withOpacity(0.4)
                                : isLow
                                    ? const Color(0xFFD97706).withOpacity(0.4)
                                    : Colors.grey.shade200,
                          ),
                        ),
                        child: Row(
                          children: [
                            // Status dot
                            Container(
                              width: 10, height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isEmpty
                                    ? const Color(0xFFE11D48)
                                    : isLow
                                        ? const Color(0xFFD97706)
                                        : const Color(0xFF059669),
                              ),
                            ),
                            const SizedBox(width: 12),
                            // Product info
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item['product_name'] ?? 'Unknown',
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                                  Text(item['sku'] ?? '',
                                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                                ],
                              ),
                            ),
                            // Stock level
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '$units units',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                    color: isEmpty
                                        ? const Color(0xFFE11D48)
                                        : isLow
                                            ? const Color(0xFFD97706)
                                            : const Color(0xFF0F172A),
                                  ),
                                ),
                                Text('Safety: $safety',
                                    style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                              ],
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

class _FilterChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color? alertColor;

  const _FilterChip({required this.label, required this.active, required this.onTap, this.alertColor});

  @override
  Widget build(BuildContext context) {
    final color = alertColor ?? const Color(0xFF2563EB);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? color.withOpacity(0.1) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? color.withOpacity(0.4) : Colors.grey.shade300),
        ),
        child: Text(label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: active ? color : Colors.grey.shade600,
            )),
      ),
    );
  }
}
