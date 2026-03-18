---
title: "HabitFlow M6+M9 — 잔디 히트맵과 iOS 로컬 알림 구현기"
description: "SwiftUI로 GitHub 잔디 스타일 히트맵 그리기, iOS 알림 64개 제한 대응, TDD로 101개 테스트까지"
category: "dev"
pubDate: "2026-03-18T01:19:00.000Z"
tags: ["swift", "swiftui", "ios", "tdd", "notification", "heatmap"]
draft: false
---

[지난 글](/posts/dev/habitflow-phase1a)에서 HabitFlow의 Phase 1a (Firestore CRUD + 기본 UI)를 TDD로 만든 이야기를 했다. 오늘은 그 위에 얹은 두 가지 기능 — GitHub 잔디 스타일 히트맵(M6)과 iOS 로컬 알림(M9)을 정리한다.

## M6: GitHub 잔디 히트맵

습관을 매일 체크하면 GitHub contribution graph처럼 초록색 칸이 채워지는 기능이다.

### HeatmapCalculator

핵심 유틸리티는 `HeatmapCalculator`다:

- `intensity(for:)` — 완료 횟수 → 0~4 단계 색상 강도
- `buildEntries(from:startDate:endDate:)` — 다중 습관 로그 → 날짜별 완료 횟수 집계
- `weeksAgoStart(weeks:from:)` — N주 전 일요일 기준 시작일

SwiftUI 그리드는 7행(요일) × N열(주) 구조다. GitHub처럼 일요일이 맨 위, 토요일이 맨 아래. 5단계 녹색(#4CAF50 기반)으로 강도를 표현한다.

습관별 필터 Picker를 달아서 전체 또는 특정 습관만 볼 수 있다.

## M9: iOS 로컬 알림 — 3종 알림 체계

습관 앱의 핵심은 "잊지 않게 해주는 것"이다. 알림 없는 습관 트래커는 쓸모없다.

### 알림 3종류

1. **사전 알림** (10분 전) — "독서 할 시간이에요" (targetTime이 있는 습관만)
2. **미완료 개별 알림** (N시간 후) — "독서를 아직 안 했어요" (사용자 설정: 30분/1시간/2시간)
3. **미완료 종합 알림** (하루 끝) — "오늘 아직 3개 습관을 완료하지 않았습니다 (독서, 러닝, 영어)"

<div style="display: flex; justify-content: center; gap: 12px; margin: 24px 0;">
  <img src="/images/posts/habitflow-m6m9/today-view.jpeg" alt="오늘 화면" width="200" />
  <img src="/images/posts/habitflow-m6m9/settings-notification.jpeg" alt="알림 설정" width="200" />
  <img src="/images/posts/habitflow-m6m9/notification-lockscreen.jpeg" alt="잠금화면 알림" width="200" />
</div>

### iOS 알림 64개 제한

iOS는 앱당 예약 가능한 알림이 **최대 64개**다. 습관이 5개이고 각각 사전+미완료 2개씩이면 하루에 10개. 일주일이면 70개로 이미 초과한다.

대응 전략: **앱 실행 시 동적 스케줄링**. 7일치만 예약하고, 앱을 열 때마다 갱신한다. 습관 트래커는 매일 여는 앱이니까 이 전략이 먹힌다.

### TDD 흐름

M9는 3단계(M9a → M9b → M9c)로 나눠서 TDD로 진행했다:

| 단계 | 내용 | 테스트 |
|------|------|--------|
| M9a | NotificationScheduler + 사전 알림 | 22개 |
| M9b | 미완료 개별/종합 알림 | 19개 |
| M9c | 설정 UI (마스터 토글, 딜레이 피커) | 7개 |

MockNotificationService를 만들어서 실제 `UNUserNotificationCenter` 없이 로직을 검증했다. 이후 `LocalNotificationService`로 실제 iOS 알림을 연결하고 실기기에서 확인.

### 리뷰에서 잡은 것들

- 시간 파싱 중복 → `parseTime` 헬퍼로 추출
- 음수 `delayMinutes` 방어 → `guard >= 0` 추가
- `onChange` save loop → `isLoaded` 플래그로 방지

## 현재 테스트 현황

| 마일스톤 | 테스트 |
|---------|--------|
| M1~M5 (Phase 1a) | 25개 |
| M6 히트맵 | 18개 |
| M7 Streak | 10개 |
| M9 로컬 알림 | 48개 |
| **총계** | **101개** |

남은 마일스톤: M8(위젯), M10~M12(통계/성취/내보내기). 다음 글에서는 위젯을 다룰 예정이다.
