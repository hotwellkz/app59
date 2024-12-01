import { collection, doc, runTransaction, serverTimestamp, query, where, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { db } from './config';
import { CategoryCardType } from '../../types';
import { formatAmount, parseAmount } from './categories';

export const transferFunds = async (
  sourceCategory: CategoryCardType,
  targetCategory: CategoryCardType,
  amount: number,
  description: string,
  isSalary?: boolean
): Promise<void> => {
  if (!amount || amount <= 0) {
    throw new Error('Сумма перевода должна быть больше нуля');
  }

  if (!description.trim()) {
    throw new Error('Необходимо указать комментарий к переводу');
  }

  try {
    await runTransaction(db, async (transaction) => {
      const sourceRef = doc(db, 'categories', sourceCategory.id);
      const targetRef = doc(db, 'categories', targetCategory.id);
      
      const sourceDoc = await transaction.get(sourceRef);
      const targetDoc = await transaction.get(targetRef);

      if (!sourceDoc.exists()) {
        throw new Error('Категория отправителя не найдена');
      }

      if (!targetDoc.exists()) {
        throw new Error('Категория получателя не найдена');
      }

      const sourceBalance = parseAmount(sourceDoc.data().amount);
      const targetBalance = parseAmount(targetDoc.data().amount);

      const withdrawalRef = doc(collection(db, 'transactions'));
      const timestamp = serverTimestamp();
      
      transaction.set(withdrawalRef, {
        categoryId: sourceCategory.id,
        fromUser: sourceCategory.title,
        toUser: targetCategory.title,
        amount: -amount,
        description,
        type: 'expense',
        date: timestamp,
        isSalary,
        relatedTransactionId: withdrawalRef.id
      });

      const depositRef = doc(collection(db, 'transactions'));
      transaction.set(depositRef, {
        categoryId: targetCategory.id,
        fromUser: sourceCategory.title,
        toUser: targetCategory.title,
        amount: amount,
        description,
        type: 'income',
        date: timestamp,
        isSalary,
        relatedTransactionId: withdrawalRef.id
      });

      transaction.update(sourceRef, {
        amount: formatAmount(sourceBalance - amount),
        updatedAt: timestamp
      });

      transaction.update(targetRef, {
        amount: formatAmount(targetBalance + amount),
        updatedAt: timestamp
      });
    });
  } catch (error) {
    console.error('Error transferring funds:', error);
    throw error;
  }
};

export const deleteTransaction = async (transactionId: string): Promise<void> => {
  if (!transactionId) {
    throw new Error('Transaction ID is required');
  }

  try {
    const batch = writeBatch(db);
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error('Transaction not found');
    }

    const transactionData = transactionSnap.data();
    const relatedTransactionId = transactionData.relatedTransactionId;

    // Delete the main transaction
    batch.delete(transactionRef);

    // If there's a related transaction, delete it too
    if (relatedTransactionId) {
      const relatedTransactionsQuery = query(
        collection(db, 'transactions'),
        where('relatedTransactionId', '==', relatedTransactionId)
      );

      const relatedTransactionsSnapshot = await getDocs(relatedTransactionsQuery);
      relatedTransactionsSnapshot.docs.forEach(doc => {
        if (doc.id !== transactionId) {
          batch.delete(doc.ref);
        }
      });
    }

    // Update category balances
    if (transactionData.categoryId) {
      const categoryRef = doc(db, 'categories', transactionData.categoryId);
      const categorySnap = await getDoc(categoryRef);

      if (categorySnap.exists()) {
        const currentAmount = parseAmount(categorySnap.data().amount);
        const newAmount = transactionData.type === 'expense'
          ? currentAmount + Math.abs(transactionData.amount)
          : currentAmount - transactionData.amount;

        batch.update(categoryRef, {
          amount: formatAmount(newAmount),
          updatedAt: serverTimestamp()
        });
      }
    }

    await batch.commit();
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw new Error('Failed to delete transaction');
  }
};