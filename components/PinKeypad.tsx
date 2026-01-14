'use client'

import { X, Delete, Check } from 'lucide-react'

interface PinKeypadProps {
    maxPins: number
    onPinClick: (pins: number) => void
    onClose: () => void
    isStrikePossible?: boolean
}

export function PinKeypad({ maxPins, onPinClick, onClose, isStrikePossible = true }: PinKeypadProps) {
    // Generate buttons 0-10
    const pins = Array.from({ length: 11 }, (_, i) => i)

    return (
        <div className="fixed bottom-0 left-0 w-full bg-neutral-900/95 backdrop-blur-xl border-t border-white/10 p-4 pb-8 z-50 animate-in slide-in-from-bottom-full duration-300">

            {/* Header / Actions */}
            <div className="flex justify-between items-center mb-4 px-2">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-widest">Select Output</span>
                <button
                    onClick={onClose}
                    className="p-2 bg-neutral-800 rounded-full text-white hover:bg-neutral-700 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-4 gap-2 md:gap-3 max-w-md mx-auto">
                {/* Buttons 1-9 */}
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pin) => (
                    <button
                        key={pin}
                        onClick={() => onPinClick(pin)}
                        disabled={pin > maxPins}
                        className="h-14 font-bold text-2xl bg-neutral-800 text-white rounded-xl shadow-lg border-b-4 border-neutral-950 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-20 disabled:pointer-events-none hover:bg-neutral-700"
                    >
                        {pin}
                    </button>
                ))}

                {/* 0 Button (Gutter) */}
                <button
                    onClick={() => onPinClick(0)}
                    className="h-14 font-bold text-lg bg-neutral-800 text-neutral-400 rounded-xl shadow-lg border-b-4 border-neutral-950 active:border-b-0 active:translate-y-1 transition-all hover:bg-neutral-700 hover:text-white"
                >
                    -
                </button>

                {/* / (Spare) or 10 (Strike/Spare completion) */}
                <button
                    onClick={() => onPinClick(10)}
                    disabled={10 > maxPins && !isStrikePossible}
                    // Logic note: If maxPins < 10 (e.g. 2nd roll), pressing this might be invalid unless it's a spare logic handled by parent? 
                    // Actually parent passes maxPins. If Roll 1 was 6, maxPins is 4. So 10 is disabled.
                    // BUT, if we want to support "Spare" button visually, we might need separate logic. 
                    // For now, simpler: user enters actual pins knocked down (e.g. 4 to complete spare).
                    // OR we can specifically highlight "Spare" (maxPins) as a special button.
                    className={`h-14 font-bold text-2xl rounded-xl shadow-lg border-b-4 border-neutral-950 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-20 disabled:pointer-events-none ${maxPins === 10
                        ? 'bg-cyan-600 text-white hover:bg-cyan-500 col-span-2'
                        : 'bg-neutral-800 text-white hover:bg-neutral-700'
                        }`}
                >
                    {maxPins === 10 ? 'STRIKE (X)' : '10'}
                    {/* Wait, if maxPins is 4, we shouldn't show 10. We should show the maxPins value? 
              No, standard is 0-10 keypad. 
              Let's allow "Spare" logic: If I click "Split" or "Spare" button?
              Standard apps usually just have 0-10. If I have 6 pins down, I press '4' to spare.
              Let's keep 0-10. 10 is only enabled if maxPins == 10.
          */}
                </button>

                {/* If maxPins < 10 (Spare opportunity), let's make a dedicated "Spare" button that sends the correct remaining pins? */}
                {maxPins < 10 && (
                    <button
                        onClick={() => onPinClick(maxPins)}
                        className="h-14 font-bold text-2xl bg-purple-600 text-white rounded-xl shadow-lg border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 transition-all hover:bg-purple-500 col-span-1"
                    >
                        /
                    </button>
                )}
            </div>
        </div>
    )
}
