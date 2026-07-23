import { useState, useEffect } from 'react'
import { searchProducts, CAN_SIZES, BOTTLE_SIZES, LIQUOR_UNITS, LIQUOR_UNIT_SIZE_MAP } from '../lib/products'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const TYPES = ['beer', 'seltzer', 'cider', 'liquor', 'other']

function FieldLabel({ children }) {
  return (
    <Label className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
      {children}
    </Label>
  )
}

function PillButton({ active, children, ...props }) {
  return (
    <button
      className={cn(
        'cursor-pointer rounded-lg border px-3 py-1.5 text-xs whitespace-nowrap transition-colors',
        active
          ? 'border-primary bg-primary/10 font-semibold text-primary'
          : 'border-input bg-secondary font-normal text-muted-foreground'
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function ItemModal({ item, onSave, onClose }) {
  const [brand, setBrand] = useState(item?.brand || '')
  const [drinkName, setDrinkName] = useState(item?.drink_name || '')
  const [flavor, setFlavor] = useState(item?.flavor || '')
  const [type, setType] = useState(item?.type || 'beer')
  const [qty, setQty] = useState(item?.quantity ?? 1)
  const [unit, setUnit] = useState(item?.unit || 'can')
  const [unitSize, setUnitSize] = useState(item?.unit_size || '12oz')
  const [error, setError] = useState('')

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
    setDrinkName(val)
    setActiveSuggestion(-1)
    const results = val.trim().length >= 1 ? searchProducts(val) : []
    setSuggestions(results)
    setShowSuggestions(results.length > 0)
  }

  function selectSuggestion(product) {
    setDrinkName(product.name)
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
    if (!drinkName.trim()) return
    if (!brand.trim()) { setError('brand is required'); return }
    setError('')
    onSave({
      brand: brand.trim(),
      drink_name: drinkName.trim(),
      flavor: flavor.trim() || null,
      type,
      quantity: Number(qty),
      unit,
      unit_size: unitSize,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{item ? 'edit item' : 'add item'}</DialogTitle>
        </DialogHeader>

        <div>
          <FieldLabel>brand</FieldLabel>
          <Input
            value={brand}
            autoFocus
            autoComplete="off"
            onChange={e => setBrand(e.target.value)}
            placeholder="e.g. Modelo"
          />
        </div>

        <div>
          <FieldLabel>drink name</FieldLabel>
          <div className="relative">
            <Input
              value={drinkName}
              autoComplete="off"
              onChange={e => handleNameChange(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onFocus={() => drinkName.trim().length >= 1 && suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={handleNameBlur}
              placeholder="e.g. Especial"
            />
            {showSuggestions && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-input bg-popover shadow-lg">
                {suggestions.map((p, i) => (
                  <div
                    key={p.name}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[13px] transition-colors',
                      i === activeSuggestion ? 'bg-secondary' : 'bg-transparent'
                    )}
                    onMouseDown={() => selectSuggestion(p)}
                    onMouseEnter={() => setActiveSuggestion(i)}
                  >
                    <span>{p.name}</span>
                    <span className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                      {p.type} · {p.defaultUnit} · {p.defaultSize}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <FieldLabel>flavor (optional)</FieldLabel>
          <Input
            value={flavor}
            autoComplete="off"
            onChange={e => setFlavor(e.target.value)}
            placeholder="e.g. Black Cherry"
          />
        </div>

        <div>
          <FieldLabel>type</FieldLabel>
          <div className="grid grid-cols-5 gap-1.5">
            {TYPES.map(t => (
              <PillButton key={t} active={type === t} onClick={() => handleTypeChange(t)}>
                {t}
              </PillButton>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>quantity</FieldLabel>
          <div className="flex items-stretch gap-2">
            <Input
              type="number"
              min="0"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-18 shrink-0"
            />
            {isLiquor ? (
              <Select value={unit} onValueChange={handleUnitChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIQUOR_UNITS.map(u => (
                    <SelectItem key={u} value={u}>{u} · {LIQUOR_UNIT_SIZE_MAP[u]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <div className="flex gap-1">
                  <PillButton active={unit === 'can'} onClick={() => setUnit('can')}>can</PillButton>
                  <PillButton active={unit === 'bottle'} onClick={() => setUnit('bottle')}>bottle</PillButton>
                </div>
                <Select value={unitSize} onValueChange={setUnitSize}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.map(sz => <SelectItem key={sz} value={sz}>{sz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>cancel</Button>
          <Button onClick={submit}>save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        brand: null,
        drink_name: parts[0] || 'unknown',
        flavor: null,
        type: resolvedType,
        quantity: parseInt(parts[2]) || 1,
        unit: resolvedType === 'liquor' ? 'fifth' : 'can',
        unit_size: resolvedType === 'liquor' ? '750ml' : '12oz',
      }
    })
    if (items.length) onSave(items)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>bulk add</DialogTitle>
        </DialogHeader>
        <div>
          <FieldLabel>one item per line: drink name, type, quantity</FieldLabel>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
            className="min-h-[120px] font-mono text-xs"
            placeholder={'Lagunitas IPA, beer, 6\nWhite Claw Black Cherry, seltzer, 12\nAngry Orchard, cider, 4'}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>cancel</Button>
          <Button onClick={submit}>add all</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
