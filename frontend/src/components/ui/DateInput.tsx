'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string; // Format ISO: YYYY-MM-DD
  onChange: (value: string) => void; // Retourne le format ISO: YYYY-MM-DD
  displayFormat?: 'dd/mm/yyyy' | 'dd-mm-yyyy';
}

/**
 * Composant DateInput qui garantit l'affichage au format jour/mois/année
 * La valeur interne reste en format ISO (YYYY-MM-DD) pour compatibilité
 */
export function DateInput({ 
  value, 
  onChange, 
  displayFormat = 'dd/mm/yyyy',
  className = '',
  ...props 
}: DateInputProps) {
  const [displayValue, setDisplayValue] = useState<string>('');

  // Convertir ISO (YYYY-MM-DD) vers format affiché (DD/MM/YYYY)
  const isoToDisplay = (isoDate: string): string => {
    if (!isoDate) return '';
    const date = new Date(isoDate + 'T00:00:00'); // Éviter les problèmes de timezone
    if (isNaN(date.getTime())) return '';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return displayFormat === 'dd/mm/yyyy' 
      ? `${day} / ${month} / ${year}`
      : `${day}-${month}-${year}`;
  };

  // Convertir format affiché (DD / MM / YYYY) vers ISO (YYYY-MM-DD)
  const displayToIso = (displayDate: string): string | null => {
    if (!displayDate) return '';
    
    // Nettoyer la chaîne (supprimer les espaces, etc.)
    const cleaned = displayDate.replace(/\s/g, '');
    
    // Accepter les formats DD/MM/YYYY ou DD-MM-YYYY ou DD / MM / YYYY
    const parts = cleaned.split(/[\/\-]/);
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return null;
    
    // Créer la date et vérifier qu'elle est valide
    const date = new Date(year, month - 1, day);
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      return null;
    }
    
    // Retourner au format ISO
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Mettre à jour la valeur affichée quand la valeur ISO change
  useEffect(() => {
    setDisplayValue(isoToDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Supprimer tous les caractères non numériques sauf les slashes déjà présents
    inputValue = inputValue.replace(/[^\d\/]/g, '');
    
    // Supprimer les slashes pour reformater
    const digitsOnly = inputValue.replace(/\//g, '');
    
    // Insérer automatiquement les slashes avec espaces (JJ / MM / AAAA)
    let formatted = '';
    for (let i = 0; i < digitsOnly.length; i++) {
      if (i === 2) {
        formatted += ' / ';
      } else if (i === 4) {
        formatted += ' / ';
      }
      formatted += digitsOnly[i];
    }
    
    // Limiter à 14 caractères (JJ / MM / AAAA avec espaces)
    if (formatted.length > 14) {
      formatted = formatted.substring(0, 14);
    }
    
    setDisplayValue(formatted);
    
    // Si l'utilisateur a saisi une date complète (14 caractères avec espaces), convertir en ISO
    if (formatted.length >= 10) {
      // Nettoyer les espaces pour la conversion
      const cleaned = formatted.replace(/\s/g, '');
      const isoDate = displayToIso(cleaned);
      if (isoDate !== null) {
        onChange(isoDate);
      }
    } else if (formatted === '') {
      onChange('');
    }
  };

  const handleBlur = () => {
    // À la perte de focus, reformater si nécessaire
    if (displayValue && displayValue !== isoToDisplay(value)) {
      const isoDate = displayToIso(displayValue);
      if (isoDate) {
        const formatted = isoToDisplay(isoDate);
        setDisplayValue(formatted);
        onChange(isoDate);
      } else {
        // Si la date n'est pas valide, restaurer la valeur précédente
        setDisplayValue(isoToDisplay(value));
      }
    } else if (displayValue && displayValue.replace(/\s/g, '').length < 8) {
      // Si la date n'est pas complète (moins de 8 chiffres), restaurer la valeur précédente
      setDisplayValue(isoToDisplay(value));
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={displayFormat === 'dd/mm/yyyy' ? 'JJ / MM / AAAA' : 'JJ-MM-AAAA'}
      maxLength={14}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

