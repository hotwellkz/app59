import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { doc, updateDoc, writeBatch, getDocs, query, where, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClientContextMenu } from '../components/ClientContextMenu';
import { Client, NewClient, initialClientState } from '../types/client';
import { ClientList } from '../components/clients/ClientList';
import { ClientModal } from '../components/clients/ClientModal';
import { ClientPage } from './ClientPage';
import { DeleteClientModal } from '../components/modals/DeleteClientModal';
import { subscribeToClients } from '../services/clientService';
import { showErrorNotification } from '../utils/notifications';
import { PageContainer } from '../components/layout/PageContainer';
import { ClientSearchBar } from '../components/clients/ClientSearchBar';
import { TransactionHistory } from '../components/transactions/TransactionHistory';
import { CategoryCardType } from '../types';
import { deleteClientWithHistory, deleteClientIconOnly } from '../utils/clientDeletion';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<NewClient>(initialClientState);
  const [showClientPage, setShowClientPage] = useState(false);
  const [status, setStatus] = useState<'building' | 'deposit' | 'built' | 'all'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryCardType | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear + i);

  useEffect(() => {
    const unsubscribe = subscribeToClients(
      (allClients) => {
        setClients(allClients);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching clients:', error);
        setLoading(false);
      },
      {
        year: selectedYear,
        status: status === 'all' ? undefined : status
      }
    );

    return () => unsubscribe();
  }, [selectedYear, status]);

  const handleContextMenu = (e: React.MouseEvent, client: Client) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setSelectedClient(client);
    setShowContextMenu(true);
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setShowClientPage(true);
  };

  const handleViewHistory = async (client: Client) => {
    try {
      const categoriesQuery = query(
        collection(db, 'categories'), 
        where('title', '==', client.lastName + ' ' + client.firstName),
        where('row', '==', 1)
      );
      
      const snapshot = await getDocs(categoriesQuery);
      if (snapshot.empty) {
        showErrorNotification('История операций недоступна');
        return;
      }
      
        const categoryDoc = snapshot.docs[0];
        const categoryData = categoryDoc.data();
        setSelectedCategory({
          id: categoryDoc.id,
          title: categoryData.title || '',
          amount: categoryData.amount || '0 ₸',
          iconName: categoryData.icon || 'User',
          color: categoryData.color || 'bg-gray-500',
          row: 1
        });
        setShowHistory(true);
    } catch (error) {
      showErrorNotification('Не удалось загрузить историю транзакций');
    }
  };

  const handleEdit = () => {
    if (selectedClient) {
      setEditingClient({
        ...selectedClient
      });
      setShowEditModal(true);
      setShowContextMenu(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    setShowDeleteModal(true);
    setShowContextMenu(false);
  };

  const handleDeleteWithHistory = async () => {
    if (!selectedClient) return;
    
    try {
      await deleteClientWithHistory(selectedClient);
      setShowDeleteModal(false);
      setSelectedClient(null);
      showErrorNotification('Клиент успешно удален');
    } catch (error) {
      console.error('Error deleting client with history:', error);
      showErrorNotification('Ошибка при удалении клиента');
    }
  };

  const handleDeleteIconOnly = async () => {
    if (!selectedClient) return;
    
    try {
      await deleteClientIconOnly(selectedClient);
      setShowDeleteModal(false);
      setSelectedClient(null);
      showErrorNotification('Клиент успешно удален');
    } catch (error) {
      console.error('Error deleting client:', error);
      showErrorNotification('Ошибка при удалении клиента');
    }
  };

  const handleToggleVisibility = async (client: Client) => {
    try {
      if (!client.id) {
        showErrorNotification('ID клиента не найден');
        return;
      }

      const clientRef = doc(db, 'clients', client.id);
      const newVisibility = !client.isIconsVisible;

      // Обновляем клиента
      await updateDoc(clientRef, { 
        isIconsVisible: newVisibility,
        updatedAt: serverTimestamp()
      });

      const [projectsQuery, clientsQuery] = [
        query(
          collection(db, 'categories'),
          where('title', '==', `${client.lastName} ${client.firstName}`),
          where('title', '==', `${client.lastName} ${client.firstName}`),
          where('row', '==', 3)
        ),
        query(
          collection(db, 'categories'),
          where('title', '==', `${client.lastName} ${client.firstName}`),
          where('row', '==', 1)
        )
      ];
      
      const [projectsSnapshot, clientsSnapshot] = await Promise.all([
        getDocs(projectsQuery),
        getDocs(clientsQuery)
      ]);

      const batch = writeBatch(db);
      
      // Update categories visibility
      const categoryDocs = [...projectsSnapshot.docs, ...clientsSnapshot.docs];
      
      if (categoryDocs.length === 0) {
        console.warn('Категории клиента не найдены');
      }
      
      categoryDocs.forEach(doc => {
        batch.update(doc.ref, { 
          isVisible: newVisibility,
          updatedAt: serverTimestamp()
        });
      });
      
      if (categoryDocs.length > 0) {
        await batch.commit();
      }
      
      // Обновляем локальное состояние
      setClients(prevClients =>
        prevClients.map(c =>
          c.id === client.id ? { ...c, isIconsVisible: newVisibility } : c
        )
      );
      showErrorNotification('Видимость успешно изменена');

    } catch (error) {
      console.error('Error toggling visibility:', error);
      showErrorNotification('Ошибка при изменении видимости иконок');
    }
  };

  const handleClientSaved = () => {
    setShowAddModal(false);
    setShowEditModal(false);
  };

  const filteredClients = clients.filter(client => {
    const searchString = searchQuery.toLowerCase();
    return (
      client.lastName.toLowerCase().includes(searchString) ||
      client.firstName.toLowerCase().includes(searchString) ||
      client.clientNumber.toLowerCase().includes(searchString) ||
      client.constructionAddress.toLowerCase().includes(searchString) ||
      (client.objectName && client.objectName.toLowerCase().includes(searchString))
    );
  });

  if (showClientPage && selectedClient) {
    return (
      <ClientPage
        client={selectedClient}
        onBack={() => setShowClientPage(false)}
        onSave={handleClientSaved}
      />
    );
  }

  return (
    <PageContainer>
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button onClick={() => window.history.back()} className="mr-4">
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Клиенты</h1>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'building' | 'deposit' | 'built' | 'all')}
                className="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              >
                <option value="all">Все</option>
                <option value="building">Строим</option>
                <option value="deposit">Задаток</option>
                <option value="built">Построено</option>
              </select>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
              >
                <Plus className="w-5 h-5 mr-1" />
                Добавить клиента
              </button>
            </div>
          </div>
          
          <div className="py-4">
            <ClientSearchBar 
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <ClientList
            clients={filteredClients}
            onContextMenu={handleContextMenu}
            onClientClick={handleClientClick}
            onToggleVisibility={handleToggleVisibility}
            onViewHistory={handleViewHistory}
            status={status}
          />
        )}
      </div>

      {showContextMenu && selectedClient && (
        <ClientContextMenu
          position={contextMenuPosition}
          onClose={() => setShowContextMenu(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusChange={async (newStatus) => {
            if (!selectedClient) return;

            try {
              const clientRef = doc(db, 'clients', selectedClient.id);
              await updateDoc(clientRef, { status: newStatus });
              setShowContextMenu(false);
            } catch (error) {
              console.error('Error updating client status:', error);
              showErrorNotification('Ошибка при изменении статуса клиента');
            }
          }}
          clientName={`${selectedClient.lastName} ${selectedClient.firstName}`}
          currentStatus={selectedClient.status}
        />
      )}

      {(showAddModal || showEditModal) && (
        <ClientModal
          isOpen={showAddModal || showEditModal}
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
          }}
          client={showEditModal ? editingClient : initialClientState}
          isEditMode={showEditModal}
          yearOptions={yearOptions}
          onSave={handleClientSaved}
        />
      )}

      {showDeleteModal && selectedClient && (
        <DeleteClientModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onDeleteWithHistory={handleDeleteWithHistory}
          onDeleteIconOnly={handleDeleteIconOnly}
          clientName={`${selectedClient.lastName} ${selectedClient.firstName}`}
        />
      )}

      {showHistory && selectedCategory && (
        <TransactionHistory
          category={selectedCategory}
          isOpen={showHistory}
          onClose={() => {
            setShowHistory(false);
            setSelectedCategory(null);
          }}
        />
      )}
    </PageContainer>
  );
};