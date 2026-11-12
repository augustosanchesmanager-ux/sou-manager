import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Star,
  Store,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  MessageSquareWarning,
  Sparkles,
  Loader2,
  Send,
} from 'lucide-react';
import {
  getPublicFeedbackContext,
  submitPublicReview,
  getRoleLabelPtBr,
  buildGoogleWriteReviewUrl,
  type PublicFeedbackContext,
} from './feedbackService';

const RATING_LABELS: Record<number, string> = {
  1: 'Muito insatisfeito',
  2: 'Abaixo do esperado',
  3: 'Regular',
  4: 'Muito bom!',
  5: 'Excelente! Impecável',
};

const PublicFeedbackPage: React.FC = () => {
  const { tenantSlug: routeSlug, token: routeToken } = useParams<{
    tenantSlug: string;
    token?: string;
  }>();
  const [searchParams] = useSearchParams();

  const tenantIdentifier = (routeSlug || searchParams.get('tenant') || '').trim();
  const initialStaffId = searchParams.get('staff') || null;
  const appointmentId = searchParams.get('appointment') || null;
  const clientId = searchParams.get('client') || null;

  const sessionToken = useMemo(() => {
    return routeToken || searchParams.get('token') || crypto.randomUUID();
  }, [routeToken, searchParams]);

  const [context, setContext] = useState<PublicFeedbackContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'establishment' | 'staff'>(
    initialStaffId ? 'staff' : 'establishment',
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>(initialStaffId || '');
  const [rating, setRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [savingStar, setSavingStar] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittedFinal, setSubmittedFinal] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!tenantIdentifier) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const ctx = await getPublicFeedbackContext(tenantIdentifier, sessionToken);
        if (!cancelled) {
          setContext(ctx);
          if (ctx?.google_place_id) {
            setGoogleReviewUrl(buildGoogleWriteReviewUrl(ctx.google_place_id));
          }
          if (initialStaffId && ctx?.staff.some((s) => s.id === initialStaffId)) {
            setScope('staff');
            setSelectedStaffId(initialStaffId);
          } else if (ctx?.staff && ctx.staff.length > 0 && !selectedStaffId) {
            setSelectedStaffId(ctx.staff[0].id);
          }
        }
      } catch {
        // Fallback silencioso
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantIdentifier, sessionToken, initialStaffId, selectedStaffId]);

  const selectedStaff = useMemo(() => {
    if (scope !== 'staff' || !context) return null;
    return context.staff.find((s) => s.id === selectedStaffId) || null;
  }, [scope, context, selectedStaffId]);

  // Captura imediata ao clicar na estrela (antes mesmo do envio do texto)
  const handleSelectStar = async (starValue: number) => {
    setRating(starValue);
    setErrorMsg(null);
    if (!tenantIdentifier) return;

    setSavingStar(true);
    try {
      const result = await submitPublicReview({
        tenant_identifier: tenantIdentifier,
        rating: starValue,
        review_scope: scope,
        staff_id: scope === 'staff' ? selectedStaffId || null : null,
        public_token: sessionToken,
        appointment_id: appointmentId,
        client_id: clientId,
        source_channel: 'whatsapp',
      });
      if (result.google_review_url) {
        setGoogleReviewUrl(result.google_review_url);
      }
    } catch {
      // Não bloqueia a UX se a gravação antecipada falhar; o submit final reenviará
    } finally {
      setSavingStar(false);
    }
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !tenantIdentifier) return;

    setSubmittingComment(true);
    setErrorMsg(null);
    try {
      const result = await submitPublicReview({
        tenant_identifier: tenantIdentifier,
        rating,
        review_scope: scope,
        staff_id: scope === 'staff' ? selectedStaffId || null : null,
        comment,
        public_token: sessionToken,
        appointment_id: appointmentId,
        client_id: clientId,
        source_channel: 'whatsapp',
      });
      if (result.google_review_url) {
        setGoogleReviewUrl(result.google_review_url);
      }
      setSubmittedFinal(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao enviar seu feedback. Tente novamente.',
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleResetToEvaluateAnother = () => {
    setRating(0);
    setComment('');
    setSubmittedFinal(false);
    setErrorMsg(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-[#B88A44] animate-spin mb-3" />
        <p className="text-xs text-neutral-400">Carregando avaliação...</p>
      </div>
    );
  }

  const brandName = context?.name || 'Barbearia';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-neutral-950 border border-neutral-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header da Barbearia */}
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B88A44]/15 border border-[#B88A44]/30 text-[#B88A44] text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="w-3 h-3" />
            Experiência & Qualidade
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white">{brandName}</h1>
          <p className="text-xs text-neutral-400">
            Sua opinião leva menos de 15 segundos e ajuda a evoluir nosso atendimento.
          </p>
        </div>

        {/* Seletor de Escopo: Estabelecimento ou Colaborador (Recepcionista, Gerente, Barbeiro) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-900 rounded-2xl border border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setScope('establishment');
              setSubmittedFinal(false);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              scope === 'establishment'
                ? 'bg-[#B88A44] text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Estabelecimento</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScope('staff');
              setSubmittedFinal(false);
              if (!selectedStaffId && context?.staff.length) {
                setSelectedStaffId(context.staff[0].id);
              }
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              scope === 'staff'
                ? 'bg-[#B88A44] text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Equipe / Profissional</span>
          </button>
        </div>

        {/* Seletor de Colaborador (Todos os cargos cadastrados no tenant) */}
        {scope === 'staff' && (
          <div className="space-y-2">
            <label
              htmlFor="feedback-staff-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400"
            >
              Quem você deseja avaliar? (Barbeiro, Recepção ou Gerência)
            </label>
            {context?.staff && context.staff.length > 0 ? (
              <select
                id="feedback-staff-select"
                value={selectedStaffId}
                onChange={(e) => {
                  setSelectedStaffId(e.target.value);
                  setSubmittedFinal(false);
                }}
                className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm font-semibold text-white outline-none focus:border-[#B88A44]"
              >
                {context.staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {getRoleLabelPtBr(member.role)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-neutral-500 italic">
                Nenhum colaborador listado no momento.
              </p>
            )}
          </div>
        )}

        {/* Estrelas de Captura Imediata */}
        <div className="text-center space-y-3 py-2">
          <p className="text-sm font-bold text-neutral-200">
            {scope === 'staff' && selectedStaff
              ? `Como foi o atendimento de ${selectedStaff.name}?`
              : `Como foi sua experiência geral na ${brandName}?`}
          </p>

          <div className="flex items-center justify-center gap-2.5" role="radiogroup">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hoveredStar || rating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => void handleSelectStar(star)}
                  aria-label={`Nota ${star} de 5`}
                  className="p-2 rounded-2xl transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                >
                  <Star
                    className={`w-9 h-9 transition-colors ${
                      active
                        ? 'fill-[#B88A44] text-[#B88A44] drop-shadow-[0_0_10px_rgba(184,138,68,0.45)]'
                        : 'text-neutral-700'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {rating > 0 && (
            <p className="text-xs font-semibold text-[#B88A44] animate-fade-in">
              {RATING_LABELS[rating]} {savingStar ? '· salvando...' : '· nota registrada'}
            </p>
          )}
        </div>

        {/* Bifurcação UX Routing */}
        {rating > 0 && !submittedFinal && (
          <form onSubmit={handleSubmitDetails} className="space-y-4 animate-fade-in">
            {rating <= 3 ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <MessageSquareWarning className="w-4 h-4 shrink-0" />
                  <span>O que deu errado? Queremos resolver isso para você.</span>
                </div>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Conte para a gerência o que aconteceu (seu relato vai direto para o gestor)..."
                  className="w-full p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-[#B88A44]"
                />
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="w-full py-3 rounded-xl bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingComment ? 'Enviando...' : 'Enviar para a Gerência'}</span>
                </button>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-black text-emerald-300">
                    Ficamos muito felizes com a sua nota!
                  </p>
                  <p className="text-xs text-neutral-300">
                    Deseja deixar um elogio interno ou publicar sua recomendação no Google?
                  </p>
                </div>

                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Deixe um elogio opcional para a equipe..."
                  className="w-full p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-[#B88A44]"
                />

                <div className="flex flex-col gap-2.5">
                  {googleReviewUrl && (
                    <a
                      href={googleReviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        void submitPublicReview({
                          tenant_identifier: tenantIdentifier,
                          rating,
                          review_scope: scope,
                          staff_id: scope === 'staff' ? selectedStaffId || null : null,
                          comment,
                          public_token: sessionToken,
                          appointment_id: appointmentId,
                          client_id: clientId,
                          source_channel: 'whatsapp',
                          redirected_to_google: true,
                        });
                      }}
                      className="w-full py-3.5 px-4 rounded-xl bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#B88A44]/25 transition-all"
                    >
                      <span>Publicar Avaliação no Google</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    type="submit"
                    disabled={submittingComment}
                    className="w-full py-2.5 rounded-xl border border-neutral-700 hover:border-[#B88A44] text-neutral-200 font-bold text-xs transition-colors cursor-pointer"
                  >
                    {submittingComment ? 'Salvando...' : 'Concluir Avaliação'}
                  </button>
                </div>
              </div>
            )}

            {errorMsg && <p className="text-xs text-red-400 text-center">{errorMsg}</p>}
          </form>
        )}

        {/* Confirmação Final + Opção de avaliar outro membro da equipe */}
        {submittedFinal && (
          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-center space-y-4 animate-fade-in">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-base font-black text-white">Obrigado pelo seu feedback!</h2>
              <p className="text-xs text-neutral-400">
                {rating <= 3
                  ? 'Sua mensagem foi encaminhada diretamente para a gerência e entraremos em contato.'
                  : 'Sua avaliação fortalece o trabalho de toda a nossa equipe.'}
              </p>
            </div>

            {rating >= 4 && googleReviewUrl && (
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 font-black text-xs inline-flex items-center justify-center gap-2"
              >
                <span>Avaliar também no Google</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <button
              type="button"
              onClick={handleResetToEvaluateAnother}
              className="w-full py-2.5 rounded-xl border border-neutral-800 hover:border-[#B88A44] text-xs font-bold text-[#B88A44] transition-colors cursor-pointer"
            >
              Avaliar outro profissional ou recepção
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicFeedbackPage;
