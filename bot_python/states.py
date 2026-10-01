from aiogram.fsm.state import State, StatesGroup

class DepositStates(StatesGroup):
    waiting_for_amount = State()
    waiting_for_screenshot = State()

class BuyStates(StatesGroup):
    waiting_for_custom_quantity = State()

class AdminStates(StatesGroup):
    waiting_for_search_user = State()
    waiting_for_add_balance = State()
    waiting_for_deduct_balance = State()
    waiting_for_search_account = State()
