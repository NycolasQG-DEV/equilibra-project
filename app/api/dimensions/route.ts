import { NextResponse } from "next/server";
import { NR1_DIMENSIONS } from "@/lib/ai/risk-matrix";

const NR1_PREVENTION_HIERARCHY = {
  1: { level: 1, label: '1º Eliminação do Fator de Risco', legalBase: 'NR-01 Item 1.4.1 "g" I', tag: 'ELIMINAÇÃO' },
  2: { level: 2, label: '2º Medida de Proteção Coletiva', legalBase: 'NR-01 Item 1.4.1 "g" II', tag: 'PROTEÇÃO COLETIVA' },
  3: { level: 3, label: '3º Organização do Trabalho & Administrativo (NR-17)', legalBase: 'NR-01 Item 1.4.1 "g" III', tag: 'ORGANIZAÇÃO DO TRABALHO' },
  4: { level: 4, label: '4º Proteção Individual (EPI)', legalBase: 'NR-01 Item 1.4.1 "g" IV', tag: 'PROTEÇÃO INDIVIDUAL' }
};

export async function GET() {
  return NextResponse.json({
    dimensions: NR1_DIMENSIONS,
    preventionHierarchy: NR1_PREVENTION_HIERARCHY,
  });
}
