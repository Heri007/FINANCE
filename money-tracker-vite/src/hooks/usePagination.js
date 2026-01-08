import { useState, useEffect } from 'react';

export const usePagination = (fetchFunction, initialPage = 1, initialLimit = 50) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const fetchData = async (page = pagination.page, limit = pagination.limit) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchFunction({ page, limit });
      
      setData(response.data || []);
      setPagination({
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
        hasNext: response.pagination.hasNext,
        hasPrev: response.pagination.hasPrev
      });
    } catch (err) {
      console.error('Pagination error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchData(page, pagination.limit);
    }
  };

  const nextPage = () => {
    if (pagination.hasNext) {
      goToPage(pagination.page + 1);
    }
  };

  const prevPage = () => {
    if (pagination.hasPrev) {
      goToPage(pagination.page - 1);
    }
  };

  const changeLimit = (newLimit) => {
    fetchData(1, newLimit);
  };

  const refresh = () => {
    fetchData(pagination.page, pagination.limit);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    pagination,
    goToPage,
    nextPage,
    prevPage,
    changeLimit,
    refresh
  };
};
