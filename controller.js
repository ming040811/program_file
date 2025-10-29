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
    const activeTouches = new Map();

    // --- 2. 터치패드 업데이트 (변경 없음) ---
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

            // --- 3. 클릭 (선택/해제) 이벤트 리스너 (변경 없음) ---
            pad.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault(); 
                
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

            touchPadsWrapper.appendChild(pad);
        });
        
        const isSelected = selectedDecoIds.length > 0;
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.disabled = !isSelected;
        });
        deleteButton.disabled = !isSelected;
        controlGroupWrapper.classList.toggle('active', isSelected);
    } // --- updateTouchPads 끝 ---


    // --- 4. ⭐ 멀티터치 이동 이벤트 핸들러 (로직 수정) ---
    
    touchPadsWrapper.addEventListener('touchstart', (e) => {
        const frameRect = mainCanvasFrame.getBoundingClientRect();
        const frameWidth = frameRect.width;
        const frameHeight = frameRect.height;

        for (const touch of e.changedTouches) {
            const targetPad = touch.target.closest('.touch-pad');
            
            // ⭐ --- 수정된 부분 --- ⭐
            // targetPad가 존재하고, 'selected' 목록에 포함되어 있을 때만 드래그 시작
            if (targetPad) {
                const decoId = targetPad.dataset.id;
                // '선택된' 아이템인지 확인
                if (selectedDecoIds.includes(decoId)) { 
                    // 터치 ID를 키로 사용하여 정보 저장
                    activeTouches.set(touch.identifier, {
                        pad: targetPad,
                        decoId: decoId,
                        lastX: touch.clientX,
                        lastY: touch.clientY,
                        frameWidth: frameWidth,
                        frameHeight: frameHeight
                    });
                }
            }
            // ⭐ --- 수정 끝 --- ⭐
        }
    }, { passive: false });

    touchPadsWrapper.addEventListener('touchmove', (e) => {
        e.preventDefault(); 

        for (const touch of e.changedTouches) {
            const dragData = activeTouches.get(touch.identifier);

            if (dragData) {
                const { pad, decoId, lastX, lastY, frameWidth, frameHeight } = dragData;

                const dx = touch.clientX - lastX;
                const dy = touch.clientY - lastY;
                
                let currentPadLeft = parseFloat(pad.style.left);
                let currentPadTop = parseFloat(pad.style.top);
                
                let newPadLeft = currentPadLeft + dx;
                let newPadTop = currentPadTop + dy;

                const padHalf = pad.offsetWidth / 2;
                newPadLeft = Math.max(padHalf, Math.min(newPadLeft, frameWidth - padHalf));
                newPadTop = Math.max(padHalf, Math.min(newPadTop, frameHeight - padHalf));

                pad.style.left = `${newPadLeft}px`;
                pad.style.top = `${newPadTop}px`;
                
                const newNormX = newPadLeft / frameWidth;
                const newNormY = newPadTop / frameHeight;

                const deco = currentDecoList.find(d => d.id === decoId);
                if (deco) { deco.x = newNormX; deco.y = newNormY; }
                
                sendMessage('DECO_CONTROL', { id: decoId, action: 'move', x: newNormX, y: newNormY });

                dragData.lastX = touch.clientX;
                dragData.lastY = touch.clientY;
            }
        }
    }, { passive: false }); 

    const touchEndOrCancel = (e) => {
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
