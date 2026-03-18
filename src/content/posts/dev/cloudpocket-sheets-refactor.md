---
title: "CloudPocket — Google Sheets 시트 분리와 UX 리팩토링"
description: "batchUpdate 400 에러의 원인, 시트 분리 전략, 모달 기반 스프레드시트 ID 입력, 카테고리 수정 기능 추가"
category: "dev"
pubDate: "2026-03-18T01:18:00.000Z"
tags: ["react-native", "expo", "google-sheets", "ux", "refactoring", "tdd"]
draft: false
---

CloudPocket은 React Native + Expo로 만든 개인 가계부 앱이다. Google Sheets를 백엔드로 사용해서 스프레드시트에서 직접 데이터를 보고 편집할 수도 있다. 오늘은 Google Sheets 연동에서 겪은 셀 범위 충돌 문제와, 그걸 해결하면서 같이 진행한 UX 개선을 정리한다.

## 문제: batchUpdate 400 에러

Google Sheets API의 `batchUpdate`로 카테고리, 결제수단, 저축상품을 한 번에 저장하는데, 간헐적으로 400 에러가 났다.

원인은 **하나의 시트에 모든 설정을 우겨넣은 구조**였다. `(필수)설정 시트` 하나에 카테고리(A~P열), 결제수단(R열), 저축상품(T열)이 공존하고 있었는데, 각각의 범위가 겹치거나 인접하면서 batchUpdate가 충돌을 일으켰다.

## 해결: 시트 분리

설정 데이터를 독립 시트로 분리했다:

| 시트 | 내용 | 범위 |
|------|------|------|
| `설정-카테고리` | 대분류+소분류 매트릭스 | A1:P20 (20행x16열) |
| `설정-결제수단` | 신용카드(A열), 체크/현금(B열) | A1:B10 |
| `(필수)설정 시트` | 미사용 데이터 유지 | 기존 그대로 |

각 시트가 A1부터 시작하니까 범위 계산이 단순해지고, batchUpdate 충돌도 사라졌다.

### 코드 변경

`CELL_RANGES` 상수를 새 시트 기반으로 변경하고, `exportSettings()`의 패딩을 `CATEGORY_MATRIX`(16x20) 상수로 통일했다. `importAll(year?)`에서는 불필요한 연도 셀 읽기를 제거하고 year 파라미터를 옵셔널로 변경.

필수 설정 검증도 추가 — 카테고리나 결제수단이 비어있으면 사용자에게 안내 메시지를 보여준다.

## UX 개선 1: 스프레드시트 ID 모달

기존에는 설정 화면에 항상 TextInput이 노출되어 있었다. Google Sheets URL이나 ID를 잘못 건드리면 데이터가 날아갈 수 있는 위험한 구조.

모달 기반으로 변경했다:
- **미등록 상태**: 점선 박스 + "등록" 버튼 → 모달 열림
- **등록 완료**: ID 마스킹 표시 (앞 4자리...뒤 4자리) + "변경" 버튼
- **URL 붙여넣기**: 정규식으로 스프레드시트 ID 자동 추출

<video controls width="100%" style="max-width: 400px; margin: 24px auto; display: block;">
  <source src="/images/posts/cloudpocket-sheets/demo.mp4" type="video/mp4" />
</video>

## UX 개선 2: 카테고리/결제수단 수정

기존에는 추가와 삭제만 가능했다. "식비"를 "식사비"로 바꾸려면 삭제하고 다시 추가해야 했다.

수정 기능을 추가했다:
- **대분류**: 수정 버튼 → 이름/아이콘 수정 모달
- **소분류**: 항목 터치 → 이름/아이콘 수정 모달
- **결제수단**: 수정 버튼 → 이름/타입/아이콘 수정 모달

기존 추가 모달을 재활용해서 추가/수정을 하나의 컴포넌트로 처리했다.

## 테스트

726개 테스트 전체 통과:
- GoogleSheetsService 24개 (신규 2: 빈 결제수단/카테고리 검증)
- BackupRestoreSection 15개 (신규 7: 모달 등록/변경/URL추출/취소)

template.xlsx도 새 시트 구조에 맞게 정리하고, 개인 데이터를 전부 클리어했다.
