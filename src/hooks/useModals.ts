import { useData } from '@/providers/DataProvider';

export function useModals() {
    const { modals, openModal, closeModal, isAnyModalOpen } = useData();
    return { modals, openModal, closeModal, isAnyModalOpen };
}
