document.addEventListener('DOMContentLoaded', () => {
    const mainCanvasFrame = document.querySelector('.main-canvas-frame');
    const touchPadsWrapper = document.querySelector('.touch-pads-wrapper');
    const deleteButton = document.getElementById('delete-selected-deco');
    const controlGroupWrapper = document.querySelector('.control-group-wrapper');

    let currentDecoList = []; // { id, x, y, rotation, scale } (정규화된 값 0-1)
    let selectedDecoId = null;

    // --- 1. 메인 창으로 메시지 전송 함수 ---
    function sendMessage(type, data = {}) {
        if (window.opener) {
            window.opener.postMessage({ type, ...data }, '*');
        }
    }

    // --- 2. 터치패드 동적 생성 및 업데이트 ---
    function updateTouchPads() {
        touchPadsWrapper.innerHTML = ''; // 기존 터치패드 모두 제거

        currentDecoList.forEach((deco, index) => {
            const pad = document.createElement('button');
            pad.classList.add('touch-pad');
            pad.id = `touch-pad-${deco.id}`; // 실제 ID 사용
            pad.dataset.id = deco.id; // 데이터셋에 ID 저장
            pad.title = `아이템 ${index + 1} 선택 및 이동`;

            // 정규화된 x, y 값을 실제 프레임 픽셀 값으로 변환
            const frameWidth = mainCanvasFrame.offsetWidth;
            const frameHeight = mainCanvasFrame.offsetHeight;
            const pixelX = deco.x * frameWidth;
            const pixelY = deco.y * frameHeight;

            pad.style.left = `${pixelX}px`;
            pad.style.top = `${pixelY}px`;
            pad.style.opacity = '1'; // active 대신 직접 opacity 설정 (항상 활성 상태)

            if (deco.id === selectedDecoId) {
                pad.classList.add('selected');
            }

            // 클릭 이벤트 추가 (선택)
            pad.addEventListener('click', (e) => {
                e.stopPropagation(); // 부모 요소로 이벤트 전파 방지
                if (selectedDecoId !== deco.id) {
                    selectedDecoId = deco.id;
                    sendMessage('DECO_SELECT', { id: selectedDecoId });
                    updateTouchPads(); // 선택 상태 UI 업데이트
                }
            });

            // 드래그 이벤트 추가
            pad.addEventListener('mousedown', initDrag);
            pad.addEventListener('touchstart', initDrag, { passive: true });

            touchPadsWrapper.appendChild(pad);
        });

        // 아이템이 선택되어 있을 때만 조작 버튼 활성화
        const isSelected = selectedDecoId !== null;
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.disabled = !isSelected;
        });
        deleteButton.disabled = !isSelected;
        controlGroupWrapper.classList.toggle('active', isSelected);
    }

    // --- 3. 터치패드 이동 (드래그) 구현 ---
    function initDrag(e) {
        const targetPad = e.currentTarget;
        const decoId = targetPad.dataset.id;

        // 선택되지 않은 아이템을 드래그하려 할 때 먼저 선택
        if (selectedDecoId !== decoId) {
            targetPad.click();
            // 선택된 후 드래그를 시작하도록 잠시 기다리거나,
            // 이벤트를 다시 발생시키는 등의 추가 로직이 필요할 수 있음.
            // 여기서는 일단 선택만 하고 드래그는 다음 인터랙션에서 가능하다고 가정.
            return;
        }

        e.preventDefault();

        const isTouch = e.type.startsWith('touch');
        let startX = isTouch ? e.touches[0].clientX : e.clientX;
        let startY = isTouch ? e.touches[0].clientY : e.clientY;

        // 패드의 현재 위치 (mainCanvasFrame 기준 픽셀)
        let currentPadLeft = parseFloat(targetPad.style.left);
        let currentPadTop = parseFloat(targetPad.style.top);

        // mainCanvasFrame의 경계 계산
        const frameRect = mainCanvasFrame.getBoundingClientRect();
        const frameLeft = frameRect.left;
        const frameTop = frameRect.top;
        const frameWidth = frameRect.width;
        const frameHeight = frameRect.height;

        function drag(e_move) {
            const currentX = isTouch ? e_move.touches[0].clientX : e_move.clientX;
            const currentY = isTouch ? e_move.touches[0].clientY : e_move.clientY;

            const dx = currentX - startX;
            const dy = currentY - startY;

            let newPadLeft = currentPadLeft + dx;
            let newPadTop = currentPadTop + dy;

            // 경계 제한: 터치패드 중앙이 프레임 안에 있도록
            // (터치패드 크기 40px 이므로, -20px ~ (frame_dim + 20px) 범위에서
            // 터치패드 중심이 0 ~ frame_dim 범위에 있도록)
            const padHalf = targetPad.offsetWidth / 2;

            newPadLeft = Math.max(padHalf, Math.min(newPadLeft, frameWidth - padHalf));
            newPadTop = Math.max(padHalf, Math.min(newPadTop, frameHeight - padHalf));

            targetPad.style.left = `${newPadLeft}px`;
            targetPad.style.top = `${newPadTop}px`;
            
            // 메인 창으로 정규화된 좌표 전송 (0 ~ 1)
            sendMessage('DECO_CONTROL', {
                id: decoId,
                action: 'move',
                x: newPadLeft / frameWidth,
                y: newPadTop / frameHeight
            });

            startX = currentX;
            startY = currentY;
            currentPadLeft = newPadLeft;
            currentPadTop = newPadTop;
        }

        function stopDrag() {
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('touchend', stopDrag);
        }

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', stopDrag);
    }

    // --- 4. 회전/크기/정렬 버튼 이벤트 리스너 ---
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!selectedDecoId || btn.disabled) return;

            const action = btn.dataset.action;
            const direction = btn.dataset.direction;

            sendMessage('DECO_CONTROL', { id: selectedDecoId, action: action, direction: direction });
        });
    });

    // --- 5. 삭제 버튼 이벤트 리스너 ---
    deleteButton.addEventListener('click', () => {
        if (!selectedDecoId || deleteButton.disabled) return;
        
        sendMessage('DECO_DELETE', { id: selectedDecoId });
        selectedDecoId = null; // 삭제 후 선택 해제
        updateTouchPads(); // UI 업데이트
    });


    // --- 6. 메인 창으로부터 메시지 수신 처리 (양방향 동기화 핵심) ---
    window.addEventListener('message', (event) => {
        // 보안을 위해 event.origin 확인 권장
        // if (event.origin !== 'http://your-main-app-origin.com') return;

        if (event.data.type === 'DECO_LIST_UPDATE') {
            currentDecoList = event.data.data;
            selectedDecoId = event.data.selectedId;
            updateTouchPads();
        }
    });

    // --- 7. 초기 요청 ---
    window.onload = () => {
        // 실제 연동 시에는 이 메시지를 보냄:
        // sendMessage('REQUEST_DECO_LIST');

        // 개발 및 테스트를 위해 더미 아이템 생성 함수 호출
        request_dummy_list();
    };


    // --- 개발/테스트용 더미 아이템 생성 함수 (실제 연동 시 삭제하거나 주석 처리) ---
    function request_dummy_list() {
        console.log("더미 아이템 생성 중...");
        currentDecoList = [
            { id: 'item1', x: 0.25, y: 0.3, rotation: 0, scale: 1 },
            { id: 'item2', x: 0.5, y: 0.6, rotation: 0, scale: 1 },
            { id: 'item3', x: 0.75, y: 0.9, rotation: 0, scale: 1 }
        ];
        selectedDecoId = 'item1'; // 첫 번째 아이템 기본 선택
        updateTouchPads();
    }

    // 창 크기 변경 시 터치패드 위치 재조정 (선택적)
    window.addEventListener('resize', () => {
        updateTouchPads(); // 리사이즈 시 컨트롤러 위치 재계산
    });

});
