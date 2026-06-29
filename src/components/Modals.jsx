import { useState, useEffect } from 'react'
import { searchProducts, CAN_SIZES, BOTTLE_SIZES, LIQUOR_UNITS, LIQUOR_UNIT_SIZE_MAP } from '../lib/products'

const TYPES = ['beer', 'seltzer', 'cider', 'liquor', 'other']

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem', zIndex: 100,
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: '12px',
    padding: '1.5rem',
    width: '100%', maxWidth: '380px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '1.25rem',
  },
  title: { fontSize: '16px', fontWeight: 600 },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1,
    padding: '2px 6px', borderRadius: '4px',
  },
  field: { marginBottom: '1rem' },
  label: {
    display: 'block', fontSize: '11px',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px',
  },
  input: {
    width: '100%', background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '9px 12px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  },
  autocompleteWrap: { position: 'relative' },
  suggestionList: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: 'var(--surface)', border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', marginTop: '3px',
    zIndex: 200, overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  suggestionItem: (active) => ({
    padding: '9px 12px', fontSize: '13px', cursor: 'pointer',
    background: active ? 'var(--surface-2)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '8px', transition: 'background 0.08s',
  }),
  suggestionMeta: {
    fontSize: '10px', color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
  },
  typeGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px',
  },
  typeBtn: (active) => ({
    padding: '7px 4px', borderRadius: 'var(--radius)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
    background: active ? 'rgba(200,245,90,0.12)' : 'var(--surface-2)',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    fontSize: '12px', fontWeight: active ? 600 : 400,
    textAlign: 'center', cursor: 'pointer', transition: 'all 0.1s',
  }),
  qtyRow: { display: 'flex', gap: '8px', alignItems: 'stretch' },
  qtyInput: {
    width: '72px', background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '9px 12px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    flexShrink: 0,
  },
  unitGroup: { display: 'flex', gap: '4px' },
  unitBtn: (active) => ({
    padding: '7px 12px', borderRadius: 'var(--radius)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
    background: active ? 'rgba(200,245,90,0.12)' : 'var(--surface-2)',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    fontSize: '12px', fontWeight: active ? 600 : 400,
    cursor: 'pointer', transition: 'all 0.1s', whiteSpace: 'nowrap',
  }),
  sizeSelect: {
    flex: 1, background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '9px 10px',
    fontSize: '13px', outline: 'none', color: 'var(--text)',
    minWidth: 0,
  },
  footer: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1.25rem' },
  cancelBtn: {
    padding: '9px 16px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border-strong)', background: 'none',
    color: 'var(--text-muted)', fontSize: '13px',
  },
  saveBtn: {
    padding: '9px 20px', borderRadius: 'var(--radius)',
    border: 'none', background: 'var(--accent)',
    color: '#0e0e0e', fontSize: '13px', fontWeight: 600,
  },
  bulkArea: {
    width: '100%', background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '9px 12px',
    fontSize: '12px', fontFamily: 'var(--font-mono)',
    outline: 'none', resize: 'vertical', minHeight: '120px',
    color: 'var(--text)',
  },
}

export function ItemModal({ item, onSave, onClose }) {
  const [name, setName] = useState(item?.name || '')
  const [type, setType] = useState(item?.type || 'beer')
  const [qty, setQty] = useState(item?.quantity ?? 1)
  const [unit, setUnit] = useState(item?.unit || 'can')
  const [unitSize, setUnitSize] = useState(item?.unit_size || '12oz')

  const [suggestions, setSuggestions] = useState([])
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const isLiquor = type === 'liquor'
  const sizes = isLiquor ? Object.values(LIQUOR_UNIT_SIZE_MAP) : (unit === 'can' ? CAN_SIZES : BOTTLE_SIZES)

  // When unit or type changes, ensure unitSize is valid for the current context
  useEffect(() => {
    if (!sizes.includes(unitSize)) setUnitSize(isLiquor ? '750ml' : '12oz')
  }, [unit, type])

  function handleTypeChange(newType) {
    setType(newType)
    if (newType === 'liquor') {
      setUnit('fifth')
      setUnitSize('750ml')
    } else if (isLiquor) {
      setUnit('can')
      setUnitSize('12oz')
    }
  }

  function handleUnitChange(newUnit) {
    setUnit(newUnit)
    if (isLiquor && LIQUOR_UNIT_SIZE_MAP[newUnit]) {
      setUnitSize(LIQUOR_UNIT_SIZE_MAP[newUnit])
    }
  }

  function handleNameChange(val) {
    setName(val)
    setActiveSuggestion(-1)
    const results = val.trim().length >= 1 ? searchProducts(val) : []
    setSuggestions(results)
    setShowSuggestions(results.length > 0)
  }

  function selectSuggestion(product) {
    setName(product.name)
    setType(product.type)
    setUnit(product.defaultUnit)
    setUnitSize(product.defaultSize)
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleNameKeyDown(e) {
    if (!showSuggestions) {
      if (e.key === 'Enter') submit()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeSuggestion >= 0) selectSuggestion(suggestions[activeSuggestion])
      else submit()
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  function handleNameBlur() {
    setTimeout(() => setShowSuggestions(false), 150)
  }

  function submit() {
    if (!name.trim()) return
    onSave({ name: name.trim(), type, quantity: Number(qty), unit, unit_size: unitSize })
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>{item ? 'edit item' : 'add item'}</span>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.field}>
          <label style={s.label}>name / brand</label>
          <div style={s.autocompleteWrap}>
            <input
              style={s.input}
              value={name}
              autoFocus
              autoComplete="off"
              onChange={e => handleNameChange(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onFocus={() => name.trim().length >= 1 && suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={handleNameBlur}
              placeholder="e.g. Modelo Especial"
            />
            {showSuggestions && (
              <div style={s.suggestionList}>
                {suggestions.map((p, i) => (
                  <div
                    key={p.name}
                    style={s.suggestionItem(i === activeSuggestion)}
                    onMouseDown={() => selectSuggestion(p)}
                    onMouseEnter={() => setActiveSuggestion(i)}
                  >
                    <span>{p.name}</span>
                    <span style={s.suggestionMeta}>{p.type} · {p.defaultUnit} · {p.defaultSize}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>type</label>
          <div style={s.typeGrid}>
            {TYPES.map(t => (
              <button key={t} style={s.typeBtn(type === t)} onClick={() => handleTypeChange(t)}>{t}</button>
            ))}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>quantity</label>
          <div style={s.qtyRow}>
            <input
              style={s.qtyInput}
              type="number"
              min="0"
              value={qty}
              onChange={e => setQty(e.target.value)}
            />
            {isLiquor ? (
              <select
                style={{ ...s.sizeSelect, flex: 1 }}
                value={unit}
                onChange={e => handleUnitChange(e.target.value)}
              >
                {LIQUOR_UNITS.map(u => (
                  <option key={u} value={u}>{u} · {LIQUOR_UNIT_SIZE_MAP[u]}</option>
                ))}
              </select>
            ) : (
              <>
                <div style={s.unitGroup}>
                  <button style={s.unitBtn(unit === 'can')} onClick={() => setUnit('can')}>can</button>
                  <button style={s.unitBtn(unit === 'bottle')} onClick={() => setUnit('bottle')}>bottle</button>
                </div>
                <select
                  style={s.sizeSelect}
                  value={unitSize}
                  onChange={e => setUnitSize(e.target.value)}
                >
                  {sizes.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>cancel</button>
          <button style={s.saveBtn} onClick={submit}>save</button>
        </div>
      </div>
    </div>
  )
}

export function BulkModal({ onSave, onClose }) {
  const [text, setText] = useState('')

  function submit() {
    const rows = text.split('\n').map(l => l.trim()).filter(Boolean)
    const items = rows.map(row => {
      const parts = row.split(',').map(p => p.trim())
      const rawType = (parts[1] || 'beer').toLowerCase()
      const resolvedType = TYPES.includes(rawType) ? rawType : 'other'
      return {
        name: parts[0] || 'unknown',
        type: resolvedType,
        quantity: parseInt(parts[2]) || 1,
        unit: resolvedType === 'liquor' ? 'fifth' : 'can',
        unit_size: resolvedType === 'liquor' ? '750ml' : '12oz',
      }
    })
    if (items.length) onSave(items)
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>bulk add</span>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={s.field}>
          <label style={s.label}>one item per line: name, type, quantity</label>
          <textarea
            style={s.bulkArea} value={text}
            onChange={e => setText(e.target.value)} autoFocus
            placeholder={"Lagunitas IPA, beer, 6\nWhite Claw Black Cherry, seltzer, 12\nAngry Orchard, cider, 4"}
          />
        </div>
        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>cancel</button>
          <button style={s.saveBtn} onClick={submit}>add all</button>
        </div>
      </div>
    </div>
  )
}
