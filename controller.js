document.addEventListener('DOMContentLoaded', () => {
    const mainCanvasFrame = document.querySelector('.main-canvas-frame');
    const touchPadsWrapper = document.querySelector('.touch-pads-wrapper');
    const deleteButton = document.getElementById('delete-selected-deco');
    const controlGroupWrapper = document.querySelector('.control-group-wrapper');

    let currentDecoList = []; 
    let selectedDecoIds = []; 

    // --- 1. 메시지 전송 함수 (변경 없음) ---
    function sendMessage(type, data = {}) {
        if (window.opener) {
            window.opener.postMessage({ type, ...data }, '*');
        }
    }

    // --- 멀티터치 상태 저장 Map ---
    // { touchId -> { pad, decoId, lastX, lastY } }
    const activeTouches = new Map();

    // --- 2. 터치패드 업데이트 ---
    function updateTouchPads() {
        touchPadsWrapper.innerHTML = ''; 

        const frameWidth = mainCanvasFrame.offsetWidth;
        const frameHeight = mainCanvasFrame.offsetHeight;

        currentDecoList.forEach((deco, index) => {
            const pad = document.createElement('button');
            pad.classList.add('touch-pad');
            pad.id = `touch-pad-${deco.id}`;
            pad.dataset.id = deco.id;
            pad.title = `아이템 ${index + 1} 선택 및 이동`;

            const pixelX = deco.x * frameWidth;
            const pixelY = deco.y * frameHeight;

            pad.style.left = `${pixelX}px`;
            pad.style.top = `${pixelY}px`;
            pad.style.opacity = '1';

            if (selectedDecoIds.includes(deco.id)) {
                pad.classList.add('selected');
            }

            // --- 3. 클릭 (선택/해제) 이벤트 리스너 ---
            // '선택'은 오직 '클릭(탭)'으로만 작동합니다.
            pad.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault(); // mousedown 등 다른 이벤트 방지
                
                const decoId = deco.id; 
                const isSelected = selectedDecoIds.includes(decoId);

                if (isSelected) {
                    selectedDecoIds = selectedDecoIds.filter(id => id !== decoId);
                } else {
                    if (selectedDecoIds.length < 2) {
                        selectedDecoIds.push(decoId);
                    } else {
                        selectedDecoIds.shift(); 
                        selectedDecoIds.push(decoId);
                    }
                }
                
                sendMessage('DECO_SELECT_MULTI', { ids: selectedDecoIds }); 
                updateTouchPads();
            });

            // 드래그(mousedown) 이벤트는 제거 -> 터치 전용으로 변경
            // pad.addEventListener('mousedown', initDrag); (제거)
            // pad.addEventListener('touchstart', initDrag, { passive: true }); (제거)

            touchPadsWrapper.appendChild(pad);
        });
        
        // 버튼 활성화 로직 (변경 없음)
        const isSelected = selectedDecoIds.length > 0;
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.disabled = !isSelected;
        });
        deleteButton.disabled = !isSelected;
        controlGroupWrapper.classList.toggle('active', isSelected);
    } // --- updateTouchPads 끝 ---


    // --- 4. ⭐ 멀티터치 이동 이벤트 핸들러 (새 로직) ---
    // 부모 요소인 touchPadsWrapper에 이벤트를 등록합니다.
    
    touchPadsWrapper.addEventListener('touchstart', (e) => {
        // '클릭' 이벤트가 작동하도록 preventDefault()를 여기서 호출하지 않습니다.
        
        const frameRect = mainCanvasFrame.getBoundingClientRect();
        const frameWidth = frameRect.width;
        const frameHeight = frameRect.height;

        // 방금 시작된 터치들만 순회
        for (const touch of e.changedTouches) {
            // 터치가 컨트롤러 위에서 시작했는지 확인
            const targetPad = touch.target.closest('.touch-pad');
            if (targetPad) {
                // 터치 ID를 키로 사용하여 정보 저장
                activeTouches.set(touch.identifier, {
                    pad: targetPad,
                    decoId: targetPad.dataset.id,
                    lastX: touch.clientX,
                    lastY: touch.clientY,
                    frameWidth: frameWidth,
                    frameHeight: frameHeight
                });
            }
        }
    }, { passive: false });

    touchPadsWrapper.addEventListener('touchmove', (e) => {
        // 드래그(move)가 시작되면 스크롤 등을 막음
        e.preventDefault(); 

        for (const touch of e.changedTouches) {
            // 이 터치 ID가 추적 중인 터치인지 확인
            const dragData = activeTouches.get(touch.identifier);

            if (dragData) {
                const { pad, decoId, lastX, lastY, frameWidth, frameHeight } = dragData;

                // 이동 거리(delta) 계산
                const dx = touch.clientX - lastX;
                const dy = touch.clientY - lastY;
                
                let currentPadLeft = parseFloat(pad.style.left);
                let currentPadTop = parseFloat(pad.style.top);
                
                let newPadLeft = currentPadLeft + dx;
                let newPadTop = currentPadTop + dy;

                // 경계 처리
                const padHalf = pad.offsetWidth / 2;
                newPadLeft = Math.max(padHalf, Math.min(newPadLeft, frameWidth - padHalf));
                newPadTop = Math.max(padHalf, Math.min(newPadTop, frameHeight - padHalf));

                // 1. 컨트롤러 위치 즉시 업데이트
                pad.style.left = `${newPadLeft}px`;
                pad.style.top = `${newPadTop}px`;
                
                const newNormX = newPadLeft / frameWidth;
                const newNormY = newPadTop / frameHeight;

                // 2. 로컬 데이터 업데이트 (손 뗐을 때 제자리로 안 돌아가게)
                const deco = currentDecoList.find(d => d.id === decoId);
                if (deco) { deco.x = newNormX; deco.y = newNormY; }
                
                // 3. 메인 창으로 메시지 전송
                sendMessage('DECO_CONTROL', { id: decoId, action: 'move', x: newNormX, y: newNormY });

                // 4. 다음 계산을 위해 'last' 위치 업데이트
                dragData.lastX = touch.clientX;
                dragData.lastY = touch.clientY;
            }
        }
    }, { passive: false }); // preventDefault를 위해 passive: false

    const touchEndOrCancel = (e) => {
        // e.preventDefault();
        // 끝난 터치들을 추적 목록에서 제거
        for (const touch of e.changedTouches) {
            activeTouches.delete(touch.identifier);
        }
    };

    touchPadsWrapper.addEventListener('touchend', touchEndOrCancel);
    touchPadsWrapper.addEventListener('touchcancel', touchEndOrCancel);


    // --- 5. 버튼 이벤트 리스너 (변경 없음) ---
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (selectedDecoIds.length === 0 || btn.disabled) return;
            const action = btn.dataset.action;
            const direction = btn.dataset.direction;
            sendMessage('DECO_CONTROL_MULTI', { 
                ids: selectedDecoIds, 
                action: action, 
                direction: direction 
            });
        });
    });

    // --- 6. 삭제 버튼 (변경 없음) ---
    deleteButton.addEventListener('click', () => {
        if (selectedDecoIds.length === 0 || deleteButton.disabled) return;
        sendMessage('DECO_DELETE_MULTI', { ids: selectedDecoIds });
        selectedDecoIds = []; 
        updateTouchPads();
    });

    // --- 7. 메시지 수신 (변경 없음) ---
    window.addEventListener('message', (event) => {
        if (event.data.type === 'DECO_LIST_UPDATE') {
            currentDecoList = event.data.data;
            selectedDecoIds = event.data.selectedIds || []; 
            updateTouchPads();
        }
    });

    // --- 8. 초기 요청 (변경 없음) ---
    window.onload = () => {
        // sendMessage('REQUEST_DECO_LIST');
        request_dummy_list(); // 테스트용 더미
    };

    function request_dummy_list() {
        console.log("더미 아이템 생성 중...");
        currentDecoList = [
            { id: 'item1', x: 0.25, y: 0.3, rotation: 0, scale: 1 },
            { id: 'item2', x: 0.5, y: 0.6, rotation: 0, scale: 1 },
            { id: 'item3', x: 0.75, y: 0.9, rotation: 0, scale: 1 }
        ];
        selectedDecoIds = ['item1']; 
        updateTouchPads();
    }

    window.addEventListener('resize', () => {
        updateTouchPads();
    });
});
