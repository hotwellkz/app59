import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ReceiptCalculationProps {
  isEditing: boolean;
  clientId: string;
}

interface ReceiptData {
  operationalExpense: number;
  sipWalls: number;
  ceilingInsulation: number;
  generalExpense: number;
  contractPrice: number;
  totalExpense: number;
  netProfit: number;
}

export const ReceiptCalculation: React.FC<ReceiptCalculationProps> = ({
  isEditing,
  clientId
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [data, setData] = useState<ReceiptData>({
    operationalExpense: 1300000,
    sipWalls: 0,
    ceilingInsulation: 0,
    generalExpense: 10000000,
    contractPrice: 0,
    totalExpense: 0,
    netProfit: 0
  });

  useEffect(() => {
    // Подписываемся на изменения в смете СИП стен
    const sipWallsUnsubscribe = onSnapshot(
      doc(db, 'sipWallsEstimates', clientId),
      (doc) => {
        if (doc.exists()) {
          const sipData = doc.data();
          const sip28Total = sipData.items.find((item: any) => 
            item.name === 'СИП панели 163 мм высота 2,8м нарощенные пр-ва HotWell.kz'
          )?.total || 0;
          const sip25Total = sipData.items.find((item: any) => 
            item.name === 'СИП панели 163 мм высота 2,5м пр-ва HotWell.kz'
          )?.total || 0;
          
          setData(prev => ({
            ...prev,
            sipWalls: sip28Total + sip25Total
          }));
        }
      });

    // Подписываемся на изменения в смете крыши
    const roofUnsubscribe = onSnapshot(
      doc(db, 'roofEstimates', clientId),
      (doc) => {
        if (doc.exists()) {
          const roofData = doc.data();
          const polystyreneTotal = roofData.items.find((item: any) =>
            item.name === 'Пенополистирол Толщ 150мм (Для Утепления пот. 2-го эт)'
          )?.total || 0;
          
          setData(prev => ({
            ...prev,
            ceilingInsulation: polystyreneTotal
          }));
        }
      });

    // Подписываемся на изменения в блоке расчета сметы
    const estimateUnsubscribe = onSnapshot(
      doc(db, 'estimates', clientId),
      (doc) => {
        if (doc.exists()) {
          const estimateData = doc.data();
          const contractPrice = estimateData.roofValues?.contractPrice?.value || 0;
          
          setData(prev => {
            const totalExpense = prev.operationalExpense + prev.sipWalls + 
              prev.ceilingInsulation + prev.generalExpense;
            
            return {
              ...prev,
              contractPrice,
              totalExpense,
              netProfit: contractPrice - totalExpense
            };
          });
        }
      });

    return () => {
      sipWallsUnsubscribe();
      roofUnsubscribe();
      estimateUnsubscribe();
    };
  }, [clientId]);

  useEffect(() => {
    const saveData = async () => {
      if (!isEditing) return;

      try {
        const docRef = doc(db, 'receiptCalculations', clientId);
        await setDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error saving receipt calculation data:', error);
      }
    };

    const debounceTimer = setTimeout(saveData, 500);
    return () => clearTimeout(debounceTimer);
  }, [clientId, isEditing, data]);

  const formatAmount = (amount: number): string => {
    return amount.toLocaleString() + ' ₸';
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center text-gray-700 hover:text-gray-900 mb-4"
      >
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 mr-1" />
        ) : (
          <ChevronDown className="w-5 h-5 mr-1" />
        )}
        Расчет по чекам
      </button>

      {isExpanded && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-2 w-1/2">Сумма чека</td>
                  <td className="px-4 py-2 w-1/2">Наименование</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 text-right">{formatAmount(data.operationalExpense)}</td>
                  <td className="px-4 py-2">Операционный расход</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 text-right">{formatAmount(data.sipWalls)}</td>
                  <td className="px-4 py-2">Стены из СИП панелей (несущие)</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 text-right">{formatAmount(data.ceilingInsulation)}</td>
                  <td className="px-4 py-2">Пенополистирол утепл потолка</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 text-right">{formatAmount(data.generalExpense)}</td>
                  <td className="px-4 py-2">Общий расход + Работа + Склад</td>
                </tr>
                <tr className="border-b bg-gray-100 font-bold">
                  <td className="px-4 py-2 text-right">{formatAmount(data.contractPrice)}</td>
                  <td className="px-4 py-2">Цена по договору</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 text-right">{formatAmount(data.totalExpense)}</td>
                  <td className="px-4 py-2">Итого общий расход</td>
                </tr>
                <tr className="bg-gray-100 font-bold text-red-600">
                  <td className="px-4 py-2 text-right">{formatAmount(data.netProfit)}</td>
                  <td className="px-4 py-2">Итого чистая прибыль</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};