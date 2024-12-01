import React from 'react';
import {
  Building2,
  Calendar,
  DollarSign,
  History,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Client } from '../../types/client';
import { useClientPayments } from '../../hooks/useClientPayments';
import { PaymentProgress } from './PaymentProgress';

interface ClientCardProps {
  client: Client;
  onContextMenu: (e: React.MouseEvent, client: Client) => void;
  onClientClick: (client: Client) => void;
  onToggleVisibility: (client: Client) => void;
  onViewHistory: (client: Client) => void;
  type: 'building' | 'deposit' | 'built';
  rowNumber: string;
}

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  onContextMenu,
  onClientClick,
  onToggleVisibility,
  onViewHistory,
  type,
  rowNumber,
}) => {
  const { progress, remainingAmount } = useClientPayments(client);

  const getStatusColors = () => {
    switch (type) {
      case 'building':
        return 'border-emerald-500 bg-emerald-50';
      case 'deposit':
        return 'border-amber-500 bg-amber-50';
      case 'built':
        return 'border-blue-500 bg-blue-50';
    }
  };

  const isDeadlineNear = () => {
    if (type !== 'building') return false;

    const startDate = client.createdAt?.toDate() || new Date();
    const deadlineDate = new Date(startDate);
    deadlineDate.setDate(deadlineDate.getDate() + client.constructionDays);

    const now = new Date();
    const daysLeft = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysLeft <= 5;
  };

  const isDeadlinePassed = () => {
    if (type !== 'building') return false;

    const startDate = client.createdAt?.toDate() || new Date();
    const deadlineDate = new Date(startDate);
    deadlineDate.setDate(deadlineDate.getDate() + client.constructionDays);

    return new Date() > deadlineDate;
  };

  const formatMoney = (amount: number): string => {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₸';
  };

  const handleHistoryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onViewHistory(client);
  };

  const handleVisibilityClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleVisibility(client);
  };

  return (
    <div
      className={`bg-white rounded-lg shadow hover:shadow-md transition-all duration-200 border-l-4 ${getStatusColors()}`}
      onContextMenu={(e) => onContextMenu(e, client)}
      onClick={() => onClientClick(client)}
    >
      <div className="p-3 sm:p-4">
        {/* Мобильная версия */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">
                {rowNumber}
              </span>
              <span
                className={`font-medium text-sm truncate ${
                  isDeadlinePassed() || isDeadlineNear()
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}
              >
                {client.lastName} {client.firstName}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-600 truncate">
              {client.objectName || '—'}
            </div>
            <div className="text-xs text-gray-600">{client.phone}</div>
            <div className="text-xs text-gray-600">
              Сумма: {formatMoney(client.totalAmount)}
            </div>

            <div className="flex items-center justify-between pt-2">
              <PaymentProgress
                progress={progress}
                remainingAmount={remainingAmount}
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={handleHistoryClick}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  onClick={handleVisibilityClick}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  {client.isIconsVisible ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Планшетная и десктопная версия */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-[50px,40px,1fr,120px,120px,140px,140px,80px] gap-3 items-center">
            <div className="text-sm font-medium text-gray-500">{rowNumber}</div>

            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                type === 'building'
                  ? 'bg-emerald-100'
                  : type === 'deposit'
                  ? 'bg-amber-100'
                  : 'bg-blue-100'
              }`}
            >
              <Building2 className="w-4 h-4 text-gray-600" />
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`font-medium text-sm truncate ${
                  isDeadlinePassed() || isDeadlineNear()
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}
              >
                {client.lastName} {client.firstName}
              </span>
            </div>

            <div className="text-sm text-gray-600 truncate">
              {client.objectName || '—'}
            </div>

            <div className="text-sm text-gray-600 truncate">{client.phone}</div>

            <div className="text-sm text-gray-600 font-medium whitespace-nowrap">
              {formatMoney(client.totalAmount)}
            </div>

            <PaymentProgress
              progress={progress}
              remainingAmount={remainingAmount}
            />

            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={handleHistoryClick}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                title="История транзакций"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={handleVisibilityClick}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                title={
                  client.isIconsVisible ? 'Скрыть иконки' : 'Показать иконки'
                }
              >
                {client.isIconsVisible ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};