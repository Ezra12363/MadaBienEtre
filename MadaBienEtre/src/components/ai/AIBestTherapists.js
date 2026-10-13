// src/components/ai/AIBestTherapists.js
// GET /ai/best-therapists (tous rôles). Classement des mieux notés.
import { useState, useEffect, useCallback } from 'react';
import aiService from '../../services/aiService';
import { AICard, AIError, AIEmpty, AILoading } from './AIPrimitives';
import AIRecommendationCard from './AIRecommendationCard';

const AIBestTherapists = ({
  title = 'Thérapeutes les mieux notés',
  limit = 5,
  onPress,
  onBook,
  showActions = true,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await aiService.getBestTherapists(limit);
    if (result.success) setItems(Array.isArray(result.data) ? result.data : []);
    else setError(result.error);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AICard title={title} icon="trophy-outline" subtitle="Thérapeutes approuvés avec avis clients">
      {loading ? (
        <AILoading />
      ) : error ? (
        <AIError message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <AIEmpty text="Aucun thérapeute noté pour le moment." />
      ) : (
        items.map((t, index) => (
          <AIRecommendationCard
            key={t.id ?? index}
            therapist={t}
            rank={index + 1}
            showScore={false}
            showReason={false}
            showActions={showActions}
            compact={!showActions}
            onPress={onPress}
            onBook={onBook}
          />
        ))
      )}
    </AICard>
  );
};

export default AIBestTherapists;
