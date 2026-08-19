/**
 * ===================================================
 * 🎓 대학원생 연구·프로젝트 계획 플래너 로직 (app.js)
 * ===================================================
 */

const { createApp, ref, computed, onMounted, watch } = Vue;

createApp({
  setup() {
    // [1] 테마 색상 팔레트 정의
    const themeColors = [
      { id: 'indigo', name: '인디고', bgClass: 'bg-indigo-600', barClass: 'bg-indigo-600' },
      { id: 'emerald', name: '에메랄드', bgClass: 'bg-emerald-600', barClass: 'bg-emerald-600' },
      { id: 'rose', name: '로즈', bgClass: 'bg-rose-500', barClass: 'bg-rose-500' },
      { id: 'amber', name: '앰버', bgClass: 'bg-amber-500', barClass: 'bg-amber-500' },
      { id: 'violet', name: '바이올렛', bgClass: 'bg-violet-600', barClass: 'bg-violet-600' },
      { id: 'cyan', name: '시안', bgClass: 'bg-cyan-600', barClass: 'bg-cyan-600' }
    ];

    // 추천 전공 태그 목록
    const commonCategories = [
      '인공지능/컴퓨터공학',
      '바이오/생명과학',
      '기계/항공우주',
      '전자전기/반도체',
      '화학/신소재',
      '인문/사회과학'
    ];

    // [2] 폼 상태 관리
    const getInitialForm = () => ({
      title: '',
      category: '',
      goal: '',
      todos: ['', '', ''],
      dueDate: getTodayPlusDays(30),
      progress: 0,
      theme: 'indigo'
    });

    const form = ref(getInitialForm());
    const editingId = ref(null);
    const isFormOpenMobile = ref(false);
    const searchQuery = ref('');
    const currentFilter = ref('all');

    // 토스트 알림 상태
    const toast = ref({ show: false, message: '', icon: '✨' });
    const showToast = (message, icon = '✨') => {
      toast.value = { show: true, message, icon };
      setTimeout(() => { toast.value.show = false; }, 3000);
    };

    // [3] 카드 목록 데이터 (LocalStorage 연동)
    const cards = ref([]);
    const STORAGE_KEY = 'grad_research_cards_v1';

    // 오늘 날짜 기준 +N일 문자열 반환 (YYYY-MM-DD)
    function getTodayPlusDays(days) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    // 로컬스토리지 불러오기
    onMounted(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          cards.value = JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse cards from storage', e);
          loadSampleCards();
        }
      } else {
        // 처음 실행 시 샘플 3개 자동 로드
        loadSampleCards();
      }
    });

    // 카드 변경 시 로컬스토리지 자동 저장
    watch(cards, (newCards) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCards));
    }, { deep: true });

    // [4] 필터 탭 정의
    const filters = [
      { id: 'all', label: '전체' },
      { id: 'ongoing', label: '진행 중' },
      { id: 'urgent', label: 'D-7 임박' },
      { id: 'completed', label: '완료됨' }
    ];

    // D-Day 계산 헬퍼 함수
    const calculateDDay = (dueDateStr) => {
      if (!dueDateStr) return 999;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(dueDateStr);
      target.setHours(0, 0, 0, 0);
      const diffTime = target.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const getDDayText = (dueDateStr) => {
      const diff = calculateDDay(dueDateStr);
      if (diff === 0) return '오늘 마감 (D-Day)';
      if (diff > 0) return `${diff}일 남음 (D-${diff})`;
      return `${Math.abs(diff)}일 지남 (D+${Math.abs(diff)})`;
    };

    const getDDayBadgeText = (dueDateStr, progress) => {
      if (progress === 100) return '완료';
      const diff = calculateDDay(dueDateStr);
      if (diff === 0) return 'D-Day';
      if (diff > 0) return `D-${diff}`;
      return `D+${Math.abs(diff)}`;
    };

    const getDDayBadgeStyle = (dueDateStr, progress) => {
      if (progress === 100) {
        return 'bg-emerald-100 text-emerald-700 border border-emerald-300';
      }
      const diff = calculateDDay(dueDateStr);
      if (diff < 0) {
        return 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse';
      }
      if (diff <= 7) {
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      }
      return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
    };

    // 필터링된 카드 목록 계산
    const filteredCards = computed(() => {
      return cards.value.filter(card => {
        // 1. 검색어 필터
        const q = searchQuery.value.trim().toLowerCase();
        const matchesSearch = !q || 
          card.title.toLowerCase().includes(q) ||
          card.category.toLowerCase().includes(q) ||
          card.goal.toLowerCase().includes(q) ||
          card.todos.some(t => t.text.toLowerCase().includes(q));

        if (!matchesSearch) return false;

        // 2. 상태 탭 필터
        if (currentFilter.value === 'completed') {
          return card.progress === 100;
        }
        if (currentFilter.value === 'ongoing') {
          return card.progress < 100;
        }
        if (currentFilter.value === 'urgent') {
          const diff = calculateDDay(card.dueDate);
          return card.progress < 100 && diff <= 7;
        }

        return true;
      });
    });

    // 필터별 개수 카운트
    const getFilteredCount = (filterId) => {
      if (filterId === 'all') return cards.value.length;
      if (filterId === 'completed') return cards.value.filter(c => c.progress === 100).length;
      if (filterId === 'ongoing') return cards.value.filter(c => c.progress < 100).length;
      if (filterId === 'urgent') return cards.value.filter(c => c.progress < 100 && calculateDDay(c.dueDate) <= 7).length;
      return 0;
    };

    // 테마 및 프로그레스 바 스타일 헬퍼
    const getThemeBarClass = (themeId) => {
      const found = themeColors.find(c => c.id === themeId);
      return found ? found.barClass : 'bg-indigo-600';
    };

    const getProgressGradient = (progress) => {
      if (progress === 100) return 'bg-gradient-to-r from-emerald-500 to-teal-400';
      if (progress >= 60) return 'bg-gradient-to-r from-indigo-500 to-violet-500';
      if (progress >= 30) return 'bg-gradient-to-r from-sky-500 to-indigo-500';
      return 'bg-gradient-to-r from-amber-400 to-orange-500';
    };

    // 할 일 관련 헬퍼
    const getActiveTodoCount = (card) => {
      return card.todos.filter(t => t.text.trim().length > 0).length;
    };

    const getCompletedTodoCount = (card) => {
      return card.todos.filter(t => t.text.trim().length > 0 && t.done).length;
    };

    const toggleTodoDone = (card, index) => {
      card.todos[index].done = !card.todos[index].done;
      
      // 할 일 체크 시 진행률 자동 연동 계산
      const total = getActiveTodoCount(card);
      const done = getCompletedTodoCount(card);
      if (total > 0 && card.progress < 100) {
        const calc = Math.round((done / total) * 100);
        card.progress = calc;
      }
    };

    // [5] 폼 동작 (생성, 수정, 리셋)
    const resetForm = () => {
      form.value = getInitialForm();
      editingId.value = null;
      showToast('입력 폼이 초기화되었습니다.', '🔄');
    };

    const saveProject = () => {
      if (!form.value.title || !form.value.category || !form.value.goal || !form.value.dueDate) {
        alert('필수 항목을 모두 입력해주세요.');
        return;
      }

      const processedTodos = form.value.todos.map(t => {
        if (typeof t === 'string') {
          return { text: t, done: false };
        }
        return t;
      });

      if (editingId.value) {
        // 기존 카드 수정
        const index = cards.value.findIndex(c => c.id === editingId.value);
        if (index !== -1) {
          cards.value[index] = {
            ...cards.value[index],
            title: form.value.title,
            category: form.value.category,
            goal: form.value.goal,
            todos: processedTodos,
            dueDate: form.value.dueDate,
            progress: form.value.progress,
            theme: form.value.theme,
            updatedAt: new Date().toISOString()
          };
          showToast('프로젝트 카드가 수정되었습니다!', '✏️');
        }
        editingId.value = null;
      } else {
        // 새 카드 추가
        const newCard = {
          id: Date.now(),
          title: form.value.title,
          category: form.value.category,
          goal: form.value.goal,
          todos: processedTodos,
          dueDate: form.value.dueDate,
          progress: form.value.progress,
          theme: form.value.theme,
          createdAt: new Date().toISOString()
        };
        cards.value.unshift(newCard);
        showToast('새 연구 계획 카드가 등록되었습니다!', '🎉');
      }

      // 폼 초기화 및 모바일 폼 닫기
      form.value = getInitialForm();
      isFormOpenMobile.value = false;
    };

    const startEdit = (card) => {
      editingId.value = card.id;
      form.value = {
        title: card.title,
        category: card.category,
        goal: card.goal,
        todos: [
          card.todos[0]?.text || '',
          card.todos[1]?.text || '',
          card.todos[2]?.text || ''
        ],
        dueDate: card.dueDate,
        progress: card.progress,
        theme: card.theme || 'indigo'
      };
      isFormOpenMobile.value = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('카드를 수정 모드로 불러왔습니다.', '📝');
    };

    const cancelEdit = () => {
      editingId.value = null;
      form.value = getInitialForm();
    };

    const deleteCard = (id) => {
      if (confirm('이 연구 계획 카드를 삭제하시겠습니까?')) {
        cards.value = cards.value.filter(c => c.id !== id);
        if (editingId.value === id) cancelEdit();
        showToast('카드가 삭제되었습니다.', '🗑️');
      }
    };

    const increaseProgress = (card) => {
      card.progress = Math.min(100, card.progress + 10);
      showToast(`진행률이 ${card.progress}%로 업데이트되었습니다.`, '📈');
    };

    const markAsComplete = (card) => {
      card.progress = 100;
      card.todos.forEach(t => { if (t.text) t.done = true; });
      showToast('프로젝트를 완료 처리했습니다! 수고하셨습니다 👏', '🎊');
    };

    // 카드 이미지(PNG) 다운로드 기능 (html2canvas)
    const exportCardImage = async (card) => {
      const el = document.getElementById('project-card-' + card.id);
      if (!el) return;
      try {
        showToast('카드 이미지를 생성 중입니다...', '📸');
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        const link = document.createElement('a');
        link.download = `연구계획_${card.title.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('카드 이미지가 다운로드되었습니다!', '💾');
      } catch (err) {
        console.error('Image export failed:', err);
        alert('이미지 저장 중 오류가 발생했습니다.');
      }
    };

    // [6] 기본 예시 데이터셋
    const loadSampleCards = () => {
      cards.value = [
        {
          id: 101,
          title: 'LLM 기반 학술 논문 자동 요약 및 인용 추천 알고리즘 연구',
          category: '인공지능/자연어처리',
          goal: 'EMNLP 2026 논문 투고를 목표로 기존 ROUGE 스코어 대비 15% 성능 향상 검증',
          todos: [
            { text: 'arXiv 최신 1만 편 데이터셋 전처리 및 임베딩 구축', done: true },
            { text: '어텐션 레이어 경량화 및 파인튜닝 실험', done: true },
            { text: '학술 논문 초안 작성 및 Ablation Study 정리', done: false }
          ],
          dueDate: getTodayPlusDays(14),
          progress: 70,
          theme: 'indigo'
        },
        {
          id: 102,
          title: '리튬이온 배터리 열폭주 방지를 위한 나노 복합 전해질 합성',
          category: '화학/신소재공학',
          goal: '고온 안정성 200℃ 유지 및 이온 전도도 향상 특성 SCI 논문 게재',
          todos: [
            { text: '나노 입자 농도별 합성 실험 5회 반복', done: true },
            { text: 'SEM/TEM 미세 구조 분석 및 임피던스 측정', done: false },
            { text: '중간 보고서 작성 및 지도교수님 미팅', done: false }
          ],
          dueDate: getTodayPlusDays(5),
          progress: 40,
          theme: 'emerald'
        },
        {
          id: 103,
          title: '대학원 석사학위 청구논문 심사 준비 및 최종 디펜스',
          category: '학위 논문',
          goal: '석사 학위 취득을 위한 3차 최종 심사 통과 및 하드커버 인쇄',
          todos: [
            { text: '심사위원 교수님 피드백 반영 및 수정본 송부', done: true },
            { text: '디펜스 발표 슬라이드 20장 제작 및 리허설', done: true },
            { text: '인준서 서명 날인 및 도서관 원문 파일 제출', done: true }
          ],
          dueDate: getTodayPlusDays(-2),
          progress: 100,
          theme: 'violet'
        }
      ];
      showToast('예시 연구 프로젝트 3종이 로드되었습니다!', '💡');
    };

    return {
      themeColors,
      commonCategories,
      form,
      editingId,
      isFormOpenMobile,
      searchQuery,
      currentFilter,
      filters,
      cards,
      filteredCards,
      toast,
      resetForm,
      saveProject,
      startEdit,
      cancelEdit,
      deleteCard,
      increaseProgress,
      markAsComplete,
      exportCardImage,
      loadSampleCards,
      toggleTodoDone,
      getDDayText,
      getDDayBadgeText,
      getDDayBadgeStyle,
      getFilteredCount,
      getThemeBarClass,
      getProgressGradient,
      getActiveTodoCount,
      getCompletedTodoCount
    };
  }
}).mount('#app');
