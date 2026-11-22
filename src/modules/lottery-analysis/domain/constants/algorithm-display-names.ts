export interface AlgorithmDisplayInfo {
  name: string;
  description: string;
}

export const ALGORITHM_DISPLAY_MAP: Record<string, AlgorithmDisplayInfo> = {
  // Weights (가중치 기반 알고리즘)
  MAX_COUNT_WEIGHTS: {
    name: '핵또 자리별 최다 출현(열번호) 가중치 알고리즘',
    description:
      '각 추첨 위치(1~6번째 자리)별로 역대 가장 높은 빈도로 당첨된 번호들의 가중치를 결합한 알고리즘',
  },
  TOTAL_MAX_COUNT_WEIGHTS: {
    name: '핵또 전체 최다 출현(열번호) 가중치 알고리즘',
    description:
      '역대 전체 회차에서 누적 출현 빈도가 가장 높은 대표 열번호들을 집중 배치한 알고리즘',
  },
  RECENT_MAX_COUNT_WEIGHTS: {
    name: '핵또 최근 최다 출현(핫볼) 가중치 알고리즘',
    description:
      '최근 5~10회차 이내 흐름이 가장 뜨거운 다출현 핫볼군에 높은 가중치를 부여한 추세 추종형 알고리즘',
  },
  MIN_COUNT_WEIGHTS: {
    name: '핵또 자리별 최소 출현(냉번호) 가중치 알고리즘',
    description:
      '각 자리별로 출현 빈도가 낮았던 냉번호들의 주기적 반등을 노리는 역발상 가중치 알고리즘',
  },
  TOTAL_MIN_COUNT_WEIGHTS: {
    name: '핵또 전체 최소 출현(냉번호) 가중치 알고리즘',
    description:
      '역대 전체 회차 중 미출현 기간이 길었던 장기 미출현 냉번호들의 평균 회귀를 겨냥한 알고리즘',
  },
  RECENT_MIN_COUNT_WEIGHTS: {
    name: '핵또 최근 최소 출현(콜드볼) 가중치 알고리즘',
    description:
      '최근 회차에서 숨을 죽이고 있던 저빈도 콜드볼들의 출현 타이밍을 포착하는 알고리즘',
  },

  // Frequency (빈도 및 연관수 알고리즘)
  PAIR_FREQUENCY: {
    name: '핵또 동반 출현 2수(페어) 빈도 알고리즘',
    description:
      '역대 당첨 데이터에서 2개 번호가 한 세트로 동시에 자주 등장했던 궁합수(페어) 패턴 알고리즘',
  },
  RECENT_PAIR_FREQUENCY: {
    name: '핵또 최근 동반 출현 2수(페어) 빈도 알고리즘',
    description:
      '최근 단기 회차 데이터에서 유의미하게 짝을 이루어 등장한 2수 연관성 분석 알고리즘',
  },
  TRIPLET_FREQUENCY: {
    name: '핵또 동반 출현 3수(트리플) 빈도 알고리즘',
    description:
      '역대 회차 중 3개 번호가 동시에 일치했던 강력한 시너지 조합 빈도를 추적한 알고리즘',
  },
  RECENT_TRIPLET_FREQUENCY: {
    name: '핵또 최근 동반 출현 3수(트리플) 빈도 알고리즘',
    description:
      '최근 회차에서 연속적 시너지를 보인 3수 그룹을 선별한 알고리즘',
  },

  // Balance (균형 및 밸런스 알고리즘)
  SUM_BALANCE: {
    name: '핵또 총합 밸런스(100~175) 최적화 알고리즘',
    description:
      '역대 1등 당첨번호의 80% 이상이 집중되는 총합 황금 구간(100~175)을 타깃팅한 밸런스 알고리즘',
  },
  RECENT_SUM_BALANCE: {
    name: '핵또 최근 총합 흐름 밸런스 알고리즘',
    description:
      '최근 회차들의 총합 상향/하향 추세를 추적하여 최적의 합계 범위를 맞춘 알고리즘',
  },
  SUM_ODD_EVEN_BALANCE: {
    name: '핵또 총합 및 홀짝(3:3/4:2) 밸런스 알고리즘',
    description:
      '총합 균형과 홀수-짝수 출현 확률이 가장 높은 황금 비율(3:3 또는 4:2)을 동시 충족하는 알고리즘',
  },
  RECENT_SUM_ODD_EVEN_BALANCE: {
    name: '핵또 최근 총합 및 홀짝 복합 밸런스 알고리즘',
    description:
      '직전 회차 홀짝 쏠림 현상을 역보정하고 최근 총합 추세를 결합한 하이브리드 알고리즘',
  },
};

export function getAlgorithmDisplayInfo(type: string): AlgorithmDisplayInfo {
  return (
    ALGORITHM_DISPLAY_MAP[type] || {
      name: `핵또 통계 알고리즘 (${type})`,
      description: '역대 로또 공공 데이터 기반의 통계 알고리즘',
    }
  );
}
