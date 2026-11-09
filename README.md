# 호돈 게임방 v59 통합본

이 ZIP 하나에 윷놀이·바둑이·오목·섯다·7포커·알까기·쿵쿵따·사천성의 실행 파일과 자산을 모두 포함합니다.
이전 수정 ZIP을 섞어 쓰지 말고 같은 서버 프로젝트에 이 통합본의 파일을 모두 덮어쓰세요.
기존 hodon-data 폴더, field-records.json 및 field-records.state는 삭제하지 마세요.

1. 압축을 풉니다. index.html·server.js·package.json·nodemon.json·hodon-client-v59.js가 같은 최상위 위치에 있는지 확인합니다.
2. 기존 프로젝트의 같은 위치에 파일을 모두 덮어쓰고 Save 합니다.
3. 서버를 Restart 한 뒤, Mac Chrome에서 Command+Shift+R로 새로고침합니다.
4. 화면·서버 표시가 모두 v59.0인지 확인합니다. 시작 로그는 HODON v59.0 입니다.

버전
- 화면/클라이언트/서버: v59.0
- package.json/package-lock.json: 59.0.0
- 실제 실행 파일: hodon-client-v59.js (app.js와 동일)

포함된 수정
- 자동 저장이 nodemon의 JSON 변경 감시에 걸려 반복 재시작되는 문제: 저장 폴더 감시 제외 + .state 파일 저장
- 기존 JSON 전적/방 파일의 자동 읽기 및 새 저장 형식으로 이어가기
- 재입장 응답 지연만으로 참가 정보와 방 화면을 지우지 않고 재시도
- 실제 실행 JS 파일을 ZIP 안에 포함하여 정적 파일 호스팅에서도 파일을 찾을 수 있게 처리
- 방 생성 시 오프라인/응답 지연/버전 불일치/프로토콜 불일치/게임 미지원 안내를 구분
- 기존 전적, 게임 규칙, 비공개 패와 서버 권한 검사 유지

저장 파일
- hodon-data/rooms.state: 방과 게임 복구
- hodon-data/sichuan-profiles.state: 사천성 전적
- field-records.state: 윷놀이 전적
이 파일이 없으면 같은 이름의 기존 .json 파일을 읽습니다. 기존 .json은 자동 삭제하지 않습니다.
호스팅에서 데이터 폴더를 유지해야 재시작/재배포 후 전적과 방을 복구할 수 있습니다.
다중 프로세스 분산 운용은 공유 DB와 Socket.IO 어댑터가 별도로 필요합니다.

검증 자료는 TEST-RESULT-v59.txt를 확인하세요.
사용자 호스팅에 이 통합본을 직접 업로드한 상태는 아니며, 업로드 후 실제 연결은 아직 검증하지 못했습니다.
