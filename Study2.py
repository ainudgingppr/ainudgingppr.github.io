import random
def calculate_score(product, preferences):
    根据 Study 2 规则计算推荐分数
    product: dict, 包含 'name', 'price', 'sustainability_score', 'category'
    preferences: dict, 包含 'budget', 'price_sensitivity', 'sustainability_importance', 'product_interest'
    # 1. 价格匹配度 (PriceFit)
    price_diff = abs(product['price'] - preferences['budget'])
    if preferences['price_sensitivity'] == 'high':
        price_fit = max(0, 1 - (price_diff / preferences['budget']))
    elif preferences['price_sensitivity'] == 'medium':
        price_fit = 0.7 + random.uniform(0, 0.3)
    else:  # low
        price_fit = 0.9 + random.uniform(0, 0.1)
    # 2. 可持续性匹配度 (SustainabilityMatch)
    if preferences['sustainability_importance'] == 'high':
        sustainability_fit = product['sustainability_score'] / 10.0
    elif preferences['sustainability_importance'] == 'medium':
        sustainability_fit = 0.5
    else:  # low
        sustainability_fit = 0.2
    # 3. 兴趣匹配度 (InterestMatch)
    if product['category'] == preferences['product_interest']:
        interest_fit = 1.0
    else:
        interest_fit = 0.3
    # 总分计算（权重：价格30%，可持续40%，兴趣30%）
    total_score = (price_fit * 0.3) + (sustainability_fit * 0.4) + (interest_fit * 0.3)
    return round(total_score, 2)
def rank_products(products, preferences, top_n=4):
    """
    对所有商品打分并排序，返回 top_n 个推荐商品
    """
    scored_products = []
    for product in products:
        score = calculate_score(product, preferences)
        scored_products.append({
            **product,
            'score': score
        })
    # 按分数降序排序
    scored_products.sort(key=lambda x: x['score'], reverse=True)
    return scored_products[:top_n]
def generate_nudge_message(preferences, top_product):
    """
    根据用户偏好和推荐商品，生成个性化引导文案
    """
    messages = []
    if preferences['sustainability_importance'] == 'high' and top_product['sustainability_score'] >= 7:
        messages.append("This option is highly eco-friendly, aligned with your values.")
    if preferences['price_sensitivity'] == 'high' and abs(top_product['price'] - preferences['budget']) <= 50:
        messages.append("This option fits well within your budget.")
    if top_product['category'] == preferences['product_interest']:
        messages.append("This is a popular choice in your preferred category.")
    if not messages:
        messages.append("This is a recommended option for you.")
    return " ".join(messages)
# --- 测试代码，用来看到运行结果 ---
if __name__ == "__main__":
    # 模拟商品池
    products_pool = [
        {'name': 'Eco Tour', 'price': 500, 'sustainability_score': 8, 'category': 'adventure'},
        {'name': 'Fast Fashion', 'price': 300, 'sustainability_score': 3, 'category': 'clothing'},
        {'name': 'Organic Clothing', 'price': 450, 'sustainability_score': 9, 'category': 'clothing'},
        {'name': 'Adventure Gear', 'price': 550, 'sustainability_score': 6, 'category': 'adventure'},
        {'name': 'Generic Product', 'price': 400, 'sustainability_score': 5, 'category': 'home'}
    ]
    # 模拟一个用户的偏好
    my_prefs = {
        'budget': 600,
        'price_sensitivity': 'medium',
        'sustainability_importance': 'high',
        'product_interest': 'adventure'
    }
    # 1. 计算单个商品分数
    my_product = products_pool[0]
    score = calculate_score(my_product, my_prefs)
    print(f"单个商品 '{my_product['name']}' 的推荐分数为: {score}")
    # 2. 商品排序与推荐
    top_recommendations = rank_products(products_pool, my_prefs, top_n=3)
    print("\nTop 3 推荐商品:")
    for idx, rec in enumerate(top_recommendations, 1):
        print(f"{idx}. {rec['name']} - 分数: {rec['score']}")
        # 3. 生成引导文案
        message = generate_nudge_message(my_prefs, rec)
        print(f"   引导文案: {message}\n")
