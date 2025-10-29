document.addEventListener('DOMContentLoaded', () => {
    const mainCanvasFrame = document.querySelector('.main-canvas-frame');
    const touchPadsWrapper = document.querySelector('.touch-pads-wrapper');
    const deleteButton = document.getElementById('delete-selected-deco');
    const controlGroupWrapper = document.querySelector('.control-group-wrapper');

    let currentDecoList = []; 
    let selectedDecoIds = []; // 다중 선택 배열

    // --- 1. 메시지 전송 함수 (변경 없음) ---
    function sendMessage(type, data = {}) {
        if (window.opener) {
            window.opener.postMessage({ type, ...data }, '*');
        }
    }

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

            // ⭐ 3. 클릭 (다중 선택) 이벤트 리스너 (변경 없음)
            pad.addEventListener('click', (e) => {
                e.stopPropagation();
                const decoId = deco.id; // deco.id 사용
                const isSelected = selectedDecoIds.includes(decoId);

                if (isSelected) {
                    // 이미 선택됨 -> 선택 해제
                    selectedDecoIds = selectedDecoIds.filter(id => id !== decoId);
                } else {
                    // 미선택 -> 선택 추가
                    if (selectedDecoIds.length < 2) {
                        selectedDecoIds.push(decoId);
                    } else {
                        // 2개 초과 (가장 오래된 것 제거 후 새 것 추가)
                        selectedDecoIds.shift(); 
                        selectedDecoIds.push(decoId);
                    }
                }
                
                sendMessage('DECO_SELECT_MULTI', { ids: selectedDecoIds }); 
                updateTouchPads(); // UI 업데이트
            });

            // 드래그 이벤트 추가
            pad.addEventListener('mousedown', initDrag);
            pad.addEventListener('touchstart', initDrag, { passive: true });

            touchPadsWrapper.appendChild(pad);
        });

        const isSelected = selectedDecoIds.length > 0;
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.disabled = !isSelected;
        });
        deleteButton.disabled = !isSelected;
        controlGroupWrapper.classList.toggle('active', isSelected);
    }

    // --- 4. 터치패드 이동 (드래그) 구현 (⭐ 로직 수정) ---
    function initDrag(e) {
        const targetPad = e.currentTarget;
        const decoId = targetPad.dataset.id;

        // --- ⭐ 드래그 시작 조건 수정 ---
        // 1. 드래그하려는 아이템이 선택 목록에 포함되어 있어야 하고,
        // 2. 오직 1개의 아이템만 선택되어 있어야 함.
        if (!selectedDecoIds.includes(decoId) || selectedDecoIds.length !== 1) {
            // 이 두 조건을 만족하지 않으면 mousedown/touchstart 이벤트를 무시하고
            // 'click' 이벤트가 선택 로직을 처리하도록 둔다.
            return; 
        }
        // --- ⭐ 수정 끝 ---

        e.preventDefault();

        const isTouch = e.type.startsWith('touch');
        let startX = isTouch ? e.touches[0].clientX : e.clientX;
        let startY = isTouch ? e.touches[0].clientY : e.clientY;

        let currentPadLeft = parseFloat(targetPad.style.left);
        let currentPadTop = parseFloat(targetPad.style.top);

        const frameRect = mainCanvasFrame.getBoundingClientRect();
        const frameWidth = frameRect.width;
        const frameHeight = frameRect.height;

        function drag(e_move) {
            const currentX = isTouch ? e_move.touches[0].clientX : e_move.clientX;
            const currentY = isTouch ? e_move.touches[0].clientY : e_move.clientY;

            const dx = currentX - startX;
            const dy = currentY - startY;

            let newPadLeft = currentPadLeft + dx;
            let newPadTop = currentPadTop + dy;

            const padHalf = targetPad.offsetWidth / 2;
            newPadLeft = Math.max(padHalf, Math.min(newPadLeft, frameWidth - padHalf));
            newPadTop = Math.max(padHalf, Math.min(newPadTop, frameHeight - padHalf));

            targetPad.style.left = `${newPadLeft}px`;
            targetPad.style.top = `${newPadTop}px`;
            
            const newNormX = newPadLeft / frameWidth;
            const newNormY = newPadTop / frameHeight;

            // 로컬 데이터 즉시 업데이트 (제자리 복귀 방지)
            const deco = currentDecoList.find(d => d.id === decoId);
            if (deco) {
                deco.x = newNormX;
                deco.y = newNormY;
            }

            sendMessage('DECO_CONTROL', {
                id: decoId,
                action: 'move',
                x: newNormX,
                y: newNormY
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

    // --- 5. 회전/크기/정렬 버튼 (변경 없음) ---
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
