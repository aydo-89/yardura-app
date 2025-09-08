// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
interface EcoTabProps {
  gramsThisMonth: number;
  methaneThisMonthLbsEq: number;
  totalGrams: number;
}

export default function EcoTab({ gramsThisMonth, methaneThisMonthLbsEq, totalGrams }: EcoTabProps) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">🌱</div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Eco Impact Tab</h3>
      <p className="text-slate-600 mb-4">
        Track your environmental impact and sustainability metrics.
      </p>
      <div className="text-sm text-slate-500">
        <p>This month: {(gramsThisMonth * 0.00220462).toFixed(1)} lbs diverted</p>
        <p>Methane saved: {methaneThisMonthLbsEq.toFixed(1)} ft³</p>
        <p>Total diverted: {(totalGrams * 0.00220462).toFixed(1)} lbs</p>
      </div>
    </div>
  );
}
