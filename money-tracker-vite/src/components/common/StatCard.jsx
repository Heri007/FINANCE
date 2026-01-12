export function StatCard({ icon: Icon, label, value, color = 'indigo' }) {
  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600',
    green: 'from-emerald-500 to-green-600',
    red: 'from-rose-500 to-red-600',
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 text-white shadow-lg transform hover:scale-105 transition-all`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium mb-2">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
          <Icon className="w-8 h-8" />
        </div>
      </div>
    </div>
  );
}
