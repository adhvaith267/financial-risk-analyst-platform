export default function EntitySelect({ label, value, onChange, options, placeholder, loading }) {
  return (
    <label className="entity-select">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={loading}>
        <option value="">{loading ? 'Loading…' : placeholder}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
